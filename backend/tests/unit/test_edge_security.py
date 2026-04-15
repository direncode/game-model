"""Unit tests for edge security components."""
from __future__ import annotations

import sys
import os
import tempfile
import textwrap
from pathlib import Path

import pytest

# Add repo root for edge imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from edge.security.classification import (
    ClassificationLevel,
    ClassificationBanner,
    ClassificationMarker,
)
from edge.security.immutable_audit import (
    AuditEntry,
    ImmutableAuditLog,
)
from edge.security.clearance import (
    ClearanceLevel,
    ClearanceManager,
)
from edge.security.fips_crypto import FIPSCrypto
from edge.network.air_gap_validator import AirGapValidator, Violation


# =====================================================================
#  ClassificationMarker
# =====================================================================

class TestClassificationMarker:
    """Test all 5 classification levels and marking logic."""

    def test_default_level_is_unclassified(self):
        marker = ClassificationMarker()
        assert marker.default_level == ClassificationLevel.UNCLASSIFIED

    def test_custom_default_level(self):
        marker = ClassificationMarker(ClassificationLevel.SECRET)
        assert marker.default_level == ClassificationLevel.SECRET

    def test_mark_api_response_unclassified(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response({"key": "value"})
        assert result["_classification"] == "UNCLASSIFIED"
        assert result["_classification_level"] == "UNCLASSIFIED"
        assert "data" in result
        assert result["data"] == {"key": "value"}

    def test_mark_api_response_secret(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response(
            {"intel": "data"}, level=ClassificationLevel.SECRET,
        )
        assert result["_classification"] == "SECRET"
        assert result["_classification_level"] == "SECRET"

    def test_mark_api_response_top_secret_with_caveats(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response(
            {"intel": "data"},
            level=ClassificationLevel.TOP_SECRET,
            caveats=["NOFORN", "ORCON"],
        )
        assert result["_classification"] == "TOP SECRET//NOFORN/ORCON"

    def test_mark_api_response_cui(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response(
            {}, level=ClassificationLevel.CUI,
        )
        assert result["_classification_level"] == "CUI"

    def test_mark_api_response_confidential(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response(
            {}, level=ClassificationLevel.CONFIDENTIAL,
        )
        assert result["_classification_level"] == "CONFIDENTIAL"

    def test_mark_api_response_includes_timestamp(self):
        marker = ClassificationMarker()
        result = marker.mark_api_response({})
        assert "_marked_at" in result
        assert "T" in result["_marked_at"]  # ISO format

    def test_mark_export_text_format(self):
        marker = ClassificationMarker()
        data = b"Some report content here."
        result = marker.mark_export(data, ClassificationLevel.SECRET, format="text")
        assert result.startswith(b"// SECRET //")
        assert result.endswith(b"// SECRET //\n")
        assert b"Some report content here." in result

    def test_mark_export_text_with_caveats(self):
        marker = ClassificationMarker()
        data = b"Intel brief."
        result = marker.mark_export(
            data, ClassificationLevel.TOP_SECRET,
            format="text", caveats=["NOFORN"],
        )
        assert b"TOP SECRET//NOFORN" in result

    def test_mark_export_binary_format(self):
        marker = ClassificationMarker()
        data = b"\x00\x01\x02\x03"
        result = marker.mark_export(data, ClassificationLevel.CONFIDENTIAL, format="binary")
        assert result.startswith(b"CLASSIFICATION:CONFIDENTIAL\n")
        assert result.endswith(b"\x00\x01\x02\x03")

    def test_derive_classification_highest_wins(self):
        marker = ClassificationMarker()
        sources = [
            ClassificationLevel.UNCLASSIFIED,
            ClassificationLevel.SECRET,
            ClassificationLevel.CUI,
        ]
        result = marker.derive_classification(sources)
        assert result == ClassificationLevel.SECRET

    def test_derive_classification_top_secret(self):
        marker = ClassificationMarker()
        sources = [
            ClassificationLevel.CONFIDENTIAL,
            ClassificationLevel.TOP_SECRET,
        ]
        assert marker.derive_classification(sources) == ClassificationLevel.TOP_SECRET

    def test_derive_classification_empty_returns_default(self):
        marker = ClassificationMarker(ClassificationLevel.CUI)
        assert marker.derive_classification([]) == ClassificationLevel.CUI

    def test_derive_classification_single_source(self):
        marker = ClassificationMarker()
        result = marker.derive_classification([ClassificationLevel.CONFIDENTIAL])
        assert result == ClassificationLevel.CONFIDENTIAL

    def test_all_five_levels_exist(self):
        levels = [
            ClassificationLevel.UNCLASSIFIED,
            ClassificationLevel.CUI,
            ClassificationLevel.CONFIDENTIAL,
            ClassificationLevel.SECRET,
            ClassificationLevel.TOP_SECRET,
        ]
        assert len(levels) == 5

    def test_banner_str_without_caveats(self):
        banner = ClassificationBanner(ClassificationLevel.SECRET)
        assert str(banner) == "SECRET"

    def test_banner_str_with_caveats(self):
        banner = ClassificationBanner(ClassificationLevel.TOP_SECRET, ["NOFORN", "ORCON"])
        assert str(banner) == "TOP SECRET//NOFORN/ORCON"

    def test_banner_as_header(self):
        banner = ClassificationBanner(ClassificationLevel.SECRET)
        assert banner.as_header() == "// SECRET //"

    def test_banner_as_footer(self):
        banner = ClassificationBanner(ClassificationLevel.CONFIDENTIAL)
        assert banner.as_footer() == "// CONFIDENTIAL //"


# =====================================================================
#  ImmutableAuditLog
# =====================================================================

class TestImmutableAuditLog:
    """Test hash-chained audit log."""

    def _make_entry(self, action="read", resource_id="res-1"):
        return AuditEntry(
            event_type="data_access",
            actor_id="user-42",
            action=action,
            resource_type="entity",
            resource_id=resource_id,
        )

    def test_single_entry(self):
        log = ImmutableAuditLog()
        entry = self._make_entry()
        result = log.append(entry)
        assert result.entry_hash != ""
        assert result.previous_hash == "0" * 64  # Genesis hash
        assert log.length == 1

    def test_chain_of_ten_entries(self):
        log = ImmutableAuditLog()
        for i in range(10):
            log.append(self._make_entry(resource_id=f"res-{i}"))
        assert log.length == 10
        # Each entry should link to the previous
        entries = log.entries
        for i in range(1, 10):
            assert entries[i].previous_hash == entries[i - 1].entry_hash

    def test_chain_verification_passes(self):
        log = ImmutableAuditLog()
        for i in range(5):
            log.append(self._make_entry(resource_id=f"res-{i}"))
        valid, reason = log.verify_chain()
        assert valid is True
        assert reason == ""

    def test_chain_verification_fails_on_tampered_entry(self):
        log = ImmutableAuditLog()
        for i in range(5):
            log.append(self._make_entry(resource_id=f"res-{i}"))
        # Tamper with an entry
        entries = log.entries
        entries[2].action = "TAMPERED"
        valid, reason = log.verify_chain(entries)
        assert valid is False
        assert "entry_hash mismatch" in reason.lower() or "Entry 2" in reason

    def test_chain_verification_fails_on_broken_link(self):
        log = ImmutableAuditLog()
        for i in range(3):
            log.append(self._make_entry(resource_id=f"res-{i}"))
        entries = log.entries
        entries[1].previous_hash = "deadbeef" * 8
        valid, reason = log.verify_chain(entries)
        assert valid is False
        assert "previous_hash mismatch" in reason.lower() or "Entry 1" in reason

    def test_empty_chain_is_valid(self):
        log = ImmutableAuditLog()
        valid, reason = log.verify_chain()
        assert valid is True
        assert reason == ""

    def test_entries_are_copies(self):
        log = ImmutableAuditLog()
        log.append(self._make_entry())
        entries = log.entries
        assert entries is not log._entries

    def test_entry_hash_is_deterministic(self):
        log1 = ImmutableAuditLog()
        log2 = ImmutableAuditLog()
        entry1 = self._make_entry()
        entry2 = self._make_entry()
        # Same timestamp for determinism
        entry2.timestamp = entry1.timestamp
        log1.append(entry1)
        log2.append(entry2)
        assert entry1.entry_hash == entry2.entry_hash


# =====================================================================
#  ClearanceManager
# =====================================================================

class TestClearanceManager:
    """Test clearance level comparisons and filtering."""

    def setup_method(self):
        self.mgr = ClearanceManager()

    def test_unclassified_can_access_unclassified(self):
        assert self.mgr.can_access_module(ClearanceLevel.UNCLASSIFIED, "unclassified") is True

    def test_unclassified_cannot_access_secret(self):
        assert self.mgr.can_access_module(ClearanceLevel.UNCLASSIFIED, "secret") is False

    def test_secret_can_access_confidential(self):
        assert self.mgr.can_access_module(ClearanceLevel.SECRET, "confidential") is True

    def test_secret_can_access_secret(self):
        assert self.mgr.can_access_module(ClearanceLevel.SECRET, "secret") is True

    def test_secret_cannot_access_top_secret(self):
        assert self.mgr.can_access_module(ClearanceLevel.SECRET, "top_secret") is False

    def test_top_secret_can_access_everything(self):
        for level_str in ["unclassified", "cui", "confidential", "secret", "top_secret"]:
            assert self.mgr.can_access_module(ClearanceLevel.TOP_SECRET, level_str) is True

    def test_cui_can_access_unclassified_and_cui(self):
        assert self.mgr.can_access_module(ClearanceLevel.CUI, "unclassified") is True
        assert self.mgr.can_access_module(ClearanceLevel.CUI, "cui") is True
        assert self.mgr.can_access_module(ClearanceLevel.CUI, "confidential") is False

    def test_filter_modules_dict_based(self):
        modules = [
            {"name": "public", "min_clearance": "unclassified"},
            {"name": "sensitive", "min_clearance": "secret"},
            {"name": "internal", "min_clearance": "cui"},
        ]
        result = self.mgr.filter_modules(modules, ClearanceLevel.CUI)
        names = [m["name"] for m in result]
        assert "public" in names
        assert "internal" in names
        assert "sensitive" not in names

    def test_filter_modules_object_based(self):
        class FakeModule:
            def __init__(self, name, min_clearance):
                self.name = name
                self.min_clearance = min_clearance

        modules = [
            FakeModule("mod-a", "unclassified"),
            FakeModule("mod-b", "top_secret"),
        ]
        result = self.mgr.filter_modules(modules, ClearanceLevel.SECRET)
        assert len(result) == 1
        assert result[0].name == "mod-a"

    def test_filter_data_by_clearance(self):
        data = [
            {"id": 1, "classification": "unclassified", "content": "public"},
            {"id": 2, "classification": "secret", "content": "intel"},
            {"id": 3, "classification": "cui", "content": "sensitive"},
        ]
        result = self.mgr.filter_data(data, ClearanceLevel.CUI)
        assert len(result) == 2
        ids = [r["id"] for r in result]
        assert 1 in ids
        assert 3 in ids
        assert 2 not in ids

    def test_filter_data_top_secret_sees_all(self):
        data = [
            {"id": 1, "classification": "unclassified"},
            {"id": 2, "classification": "top_secret"},
        ]
        result = self.mgr.filter_data(data, ClearanceLevel.TOP_SECRET)
        assert len(result) == 2

    def test_filter_data_missing_classification_defaults_to_unclassified(self):
        data = [{"id": 1, "content": "no marking"}]
        result = self.mgr.filter_data(data, ClearanceLevel.UNCLASSIFIED)
        assert len(result) == 1

    def test_parse_clearance_with_spaces_and_hyphens(self):
        # "top secret" with space should still parse
        assert self.mgr.can_access_module(ClearanceLevel.TOP_SECRET, "top secret") is True
        assert self.mgr.can_access_module(ClearanceLevel.TOP_SECRET, "top-secret") is True


# =====================================================================
#  FIPSCrypto
# =====================================================================

class TestFIPSCrypto:
    """Test FIPS-compliant cryptographic operations."""

    def test_password_hash_format(self):
        hashed = FIPSCrypto.hash_password("mysecretpassword")
        assert hashed.startswith("pbkdf2:sha256:")
        parts = hashed.split("$")
        assert len(parts) == 3

    def test_password_hash_and_verify(self):
        password = "correct-horse-battery-staple"
        hashed = FIPSCrypto.hash_password(password)
        assert FIPSCrypto.verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        hashed = FIPSCrypto.hash_password("right_password")
        assert FIPSCrypto.verify_password("wrong_password", hashed) is False

    def test_password_verify_with_corrupted_hash(self):
        assert FIPSCrypto.verify_password("any", "not-a-valid-hash") is False

    def test_password_verify_empty_hash(self):
        assert FIPSCrypto.verify_password("any", "") is False

    def test_different_passwords_produce_different_hashes(self):
        h1 = FIPSCrypto.hash_password("password1")
        h2 = FIPSCrypto.hash_password("password2")
        assert h1 != h2

    def test_same_password_produces_different_hashes_different_salt(self):
        h1 = FIPSCrypto.hash_password("same_password")
        h2 = FIPSCrypto.hash_password("same_password")
        assert h1 != h2  # Different salts

    def test_encrypt_decrypt_roundtrip(self):
        key = FIPSCrypto.generate_key(32)
        plaintext = b"Hello, World! This is a secret message."
        ciphertext = FIPSCrypto.encrypt_at_rest(plaintext, key)
        decrypted = FIPSCrypto.decrypt_at_rest(ciphertext, key)
        assert decrypted == plaintext

    def test_encrypt_wrong_key_fails(self):
        key1 = FIPSCrypto.generate_key(32)
        key2 = FIPSCrypto.generate_key(32)
        plaintext = b"Secret data"
        ciphertext = FIPSCrypto.encrypt_at_rest(plaintext, key1)
        with pytest.raises(Exception):
            FIPSCrypto.decrypt_at_rest(ciphertext, key2)

    def test_encrypt_invalid_key_length_raises(self):
        with pytest.raises(ValueError, match="AES-256 key must be"):
            FIPSCrypto.encrypt_at_rest(b"data", b"short")

    def test_decrypt_invalid_key_length_raises(self):
        with pytest.raises(ValueError, match="AES-256 key must be"):
            FIPSCrypto.decrypt_at_rest(b"data", b"short")

    def test_tampered_ciphertext_fails(self):
        key = FIPSCrypto.generate_key(32)
        plaintext = b"Sensitive info"
        ciphertext = FIPSCrypto.encrypt_at_rest(plaintext, key)
        # Tamper with the ciphertext
        tampered = bytearray(ciphertext)
        tampered[-1] ^= 0xFF
        with pytest.raises(Exception):
            FIPSCrypto.decrypt_at_rest(bytes(tampered), key)

    def test_sign_and_verify(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        private_key_obj = Ed25519PrivateKey.generate()
        private_bytes = private_key_obj.private_bytes_raw()
        public_bytes = private_key_obj.public_key().public_bytes_raw()

        data = b"Message to sign"
        signature = FIPSCrypto.sign_data(data, private_bytes)
        assert FIPSCrypto.verify_signature(data, signature, public_bytes) is True

    def test_wrong_signature_fails(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        key1 = Ed25519PrivateKey.generate()
        key2 = Ed25519PrivateKey.generate()

        data = b"Message"
        signature = FIPSCrypto.sign_data(data, key1.private_bytes_raw())
        # Verify with wrong public key
        assert FIPSCrypto.verify_signature(
            data, signature, key2.public_key().public_bytes_raw(),
        ) is False

    def test_tampered_data_signature_fails(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        key = Ed25519PrivateKey.generate()
        data = b"Original message"
        signature = FIPSCrypto.sign_data(data, key.private_bytes_raw())
        # Verify with altered data
        assert FIPSCrypto.verify_signature(
            b"Tampered message", signature, key.public_key().public_bytes_raw(),
        ) is False

    def test_generate_key_default_length(self):
        key = FIPSCrypto.generate_key()
        assert len(key) == 32

    def test_generate_key_custom_length(self):
        key = FIPSCrypto.generate_key(64)
        assert len(key) == 64

    def test_generate_key_is_random(self):
        k1 = FIPSCrypto.generate_key()
        k2 = FIPSCrypto.generate_key()
        assert k1 != k2


# =====================================================================
#  AirGapValidator
# =====================================================================

class TestAirGapValidator:
    """Test air-gap violation scanning."""

    def _write_file(self, tmp_dir: str, filename: str, content: str) -> str:
        path = os.path.join(tmp_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(textwrap.dedent(content))
        return path

    def test_clean_file_no_violations(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "clean.py", """\
                import os
                import json

                def process():
                    data = json.loads('{}')
                    return data
            """)
            violations = validator.scan_codebase(tmp)
            assert len(violations) == 0

    def test_detects_https_url(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "bad.py", """\
                API_URL = "https://api.example.com/v1"
            """)
            violations = validator.scan_codebase(tmp)
            assert len(violations) >= 1
            assert any("external URL" in v.description.lower() or "url" in v.description.lower()
                       for v in violations)

    def test_detects_requests_get(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "fetcher.py", """\
                import requests

                def fetch():
                    return requests.get("http://external.com/data")
            """)
            violations = validator.scan_codebase(tmp)
            assert len(violations) >= 1

    def test_localhost_url_not_flagged(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "local.py", """\
                URL = "http://localhost:8080/api"
            """)
            violations = validator.scan_codebase(tmp)
            # Localhost should not be flagged by the URL pattern
            url_violations = [v for v in violations if "external URL" in v.description.lower()
                              or "Hardcoded" in v.description]
            assert len(url_violations) == 0

    def test_allowed_hosts_not_flagged(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "local.py", """\
                URL = "http://127.0.0.1:5000/api"
            """)
            violations = validator.scan_codebase(tmp)
            url_violations = [v for v in violations if "Hardcoded" in v.description]
            assert len(url_violations) == 0

    def test_detects_suspect_imports(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "cloud.py", """\
                import boto3
                import paramiko
            """)
            violations = validator.scan_codebase(tmp)
            assert len(violations) >= 2
            descriptions = [v.description for v in violations]
            assert any("boto3" in d for d in descriptions)
            assert any("paramiko" in d for d in descriptions)

    def test_comment_lines_skipped(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "commented.py", """\
                # requests.get("https://example.com")
                x = 1
            """)
            violations = validator.scan_codebase(tmp)
            url_violations = [v for v in violations if "Hardcoded" in v.description
                              or "requests" in v.description.lower()]
            assert len(url_violations) == 0

    def test_nonexistent_path_returns_empty(self):
        validator = AirGapValidator()
        violations = validator.scan_codebase("/nonexistent/path/abc123")
        assert violations == []

    def test_scan_imports_detects_from_import(self):
        validator = AirGapValidator()
        source = "from urllib.request import urlopen\n"
        violations = validator.scan_imports("test.py", source)
        assert len(violations) >= 1
        assert any("urllib" in v.description for v in violations)

    def test_extra_allowed_hosts(self):
        validator = AirGapValidator(extra_allowed_hosts=["internal.corp.com"])
        assert "internal.corp.com" in validator._allowed

    def test_severity_levels(self):
        validator = AirGapValidator()
        with tempfile.TemporaryDirectory() as tmp:
            self._write_file(tmp, "critical.py", """\
                import smtplib
            """)
            violations = validator.scan_codebase(tmp)
            smtp_violations = [v for v in violations if "smtplib" in v.description]
            assert len(smtp_violations) >= 1
            assert smtp_violations[0].severity == "critical"
