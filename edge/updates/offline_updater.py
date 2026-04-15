"""Offline update mechanism for air-gapped deployments.

Updates are distributed as signed packages that can be transferred
via USB or other physical media.  Each package contains a manifest,
file payloads, and an Ed25519 signature.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import tarfile
import time
from pathlib import Path

from .signature_verifier import SignatureVerifier

logger = logging.getLogger(__name__)

_VERSION_FILE = "VERSION"


class OfflineUpdater:
    """Create, verify, and apply offline update packages."""

    def __init__(self, base_dir: str = ".", version_file: str = _VERSION_FILE) -> None:
        self._base_dir = Path(base_dir)
        self._version_file = self._base_dir / version_file

    def get_current_version(self) -> str:
        """Read the current installed version from the VERSION file."""
        if self._version_file.exists():
            return self._version_file.read_text(encoding="utf-8").strip()
        return "0.0.0"

    def create_update_package(
        self,
        from_version: str,
        to_version: str,
        paths: list[str],
    ) -> bytes:
        """Create a tarball update package from the specified file paths.

        The package layout::

            manifest.json     — metadata (versions, file hashes, timestamp)
            files/            — actual file payloads

        Returns the raw bytes of the tar.gz archive (unsigned).
        Use :class:`SignatureVerifier` to sign the resulting package.
        """
        buf = io.BytesIO()
        manifest_entries: list[dict] = []

        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for rel_path in paths:
                full = self._base_dir / rel_path
                if not full.exists():
                    logger.warning("Skipping missing file: %s", full)
                    continue

                data = full.read_bytes()
                file_hash = hashlib.sha256(data).hexdigest()
                manifest_entries.append({
                    "path": rel_path,
                    "size": len(data),
                    "sha256": file_hash,
                })

                info = tarfile.TarInfo(name=f"files/{rel_path}")
                info.size = len(data)
                info.mtime = int(time.time())
                tar.addfile(info, io.BytesIO(data))

            # Write manifest
            manifest = {
                "from_version": from_version,
                "to_version": to_version,
                "created_at": time.time(),
                "file_count": len(manifest_entries),
                "files": manifest_entries,
            }
            manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
            info = tarfile.TarInfo(name="manifest.json")
            info.size = len(manifest_bytes)
            info.mtime = int(time.time())
            tar.addfile(info, io.BytesIO(manifest_bytes))

        logger.info(
            "Created update package %s -> %s (%d files, %d bytes)",
            from_version, to_version, len(manifest_entries), buf.tell(),
        )
        return buf.getvalue()

    def verify_package(self, package: bytes, public_key: bytes) -> bool:
        """Verify the Ed25519 signature of an update package.

        Expects the last 64 bytes of *package* to be the signature
        over the preceding bytes.
        """
        if len(package) <= 64:
            return False

        payload = package[:-64]
        signature = package[-64:]

        verifier = SignatureVerifier()
        verifier._public_key = public_key
        return verifier.verify(payload, signature)

    def apply_update(self, package: bytes) -> dict:
        """Extract and apply an update package to the base directory.

        Returns a dict with ``{"version": ..., "files_applied": N, "errors": [...]}``.
        """
        # Strip signature if present (last 64 bytes if package is signed)
        buf = io.BytesIO(package)
        errors: list[str] = []
        files_applied = 0
        new_version = "unknown"

        try:
            with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                # Read manifest first
                manifest_member = tar.getmember("manifest.json")
                f = tar.extractfile(manifest_member)
                if f is None:
                    return {"version": new_version, "files_applied": 0, "errors": ["Missing manifest"]}
                manifest = json.loads(f.read())
                new_version = manifest.get("to_version", "unknown")

                # Verify file hashes and extract
                hash_lookup = {e["path"]: e["sha256"] for e in manifest.get("files", [])}

                for member in tar.getmembers():
                    if not member.name.startswith("files/"):
                        continue

                    rel_path = member.name[len("files/"):]
                    target = self._base_dir / rel_path

                    f = tar.extractfile(member)
                    if f is None:
                        continue

                    data = f.read()
                    actual_hash = hashlib.sha256(data).hexdigest()
                    expected_hash = hash_lookup.get(rel_path)

                    if expected_hash and actual_hash != expected_hash:
                        errors.append(f"Hash mismatch for {rel_path}")
                        continue

                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    files_applied += 1

            # Update version file
            self._version_file.write_text(new_version, encoding="utf-8")
            logger.info("Applied update to version %s (%d files)", new_version, files_applied)

        except Exception as exc:
            errors.append(str(exc))
            logger.exception("Failed to apply update package")

        return {
            "version": new_version,
            "files_applied": files_applied,
            "errors": errors,
        }
