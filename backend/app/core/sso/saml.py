"""SAML 2.0 Service Provider integration.

Built from primitives (xml.etree, base64, zlib) so the module works in
air-gapped edge deployments without the ``python3-saml`` library.
"""

from __future__ import annotations

import base64
import logging
import uuid
import zlib
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import quote_plus, urlencode
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

# ── SAML XML namespaces ──────────────────────────────────────────────

NS_SAML = "urn:oasis:names:tc:SAML:2.0:assertion"
NS_SAMLP = "urn:oasis:names:tc:SAML:2.0:protocol"
NS_DS = "http://www.w3.org/2000/09/xmldsig#"
NS_MD = "urn:oasis:names:tc:SAML:2.0:metadata"

# Register namespace prefixes for cleaner output
ET.register_namespace("saml", NS_SAML)
ET.register_namespace("samlp", NS_SAMLP)
ET.register_namespace("ds", NS_DS)
ET.register_namespace("md", NS_MD)


# ── Data models ──────────────────────────────────────────────────────


@dataclass
class SAMLConfig:
    """Configuration for this Service Provider and the remote IDP."""

    entity_id: str  # Our SP entity ID
    acs_url: str  # Assertion Consumer Service URL
    slo_url: str = ""  # Single Logout URL
    idp_entity_id: str = ""  # Identity Provider entity ID
    idp_sso_url: str = ""  # IDP SSO URL
    idp_slo_url: str = ""  # IDP SLO URL
    idp_certificate: str = ""  # IDP X.509 certificate (PEM)
    sp_private_key: str = ""  # Our private key for signing
    sp_certificate: str = ""  # Our certificate
    name_id_format: str = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    want_assertions_signed: bool = True
    want_response_signed: bool = True


@dataclass
class SAMLUser:
    """User information extracted from a SAML assertion."""

    email: str
    name: str = ""
    groups: list[str] = field(default_factory=list)
    attributes: dict = field(default_factory=dict)
    session_index: str = ""


# ── Provider implementation ──────────────────────────────────────────


class SAMLProvider:
    """SAML 2.0 Service Provider.

    Generates AuthnRequests, processes Responses, and builds SP metadata
    using only the Python standard library.
    """

    def __init__(self, config: SAMLConfig) -> None:
        self._config = config
        self._pending_requests: dict[str, datetime] = {}

    # ── AuthnRequest ─────────────────────────────────────────────

    def create_auth_request(self, relay_state: str = "") -> tuple[str, str]:
        """Create a SAML AuthnRequest using HTTP-Redirect binding.

        Returns:
            Tuple of (redirect_url, request_id).
        """
        request_id = f"_lo_{uuid.uuid4().hex}"
        issue_instant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        root = ET.Element(f"{{{NS_SAMLP}}}AuthnRequest")
        root.set("ID", request_id)
        root.set("Version", "2.0")
        root.set("IssueInstant", issue_instant)
        root.set("Destination", self._config.idp_sso_url)
        root.set("AssertionConsumerServiceURL", self._config.acs_url)
        root.set("ProtocolBinding", "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST")

        # Issuer
        issuer = ET.SubElement(root, f"{{{NS_SAML}}}Issuer")
        issuer.text = self._config.entity_id

        # NameIDPolicy
        name_id_policy = ET.SubElement(root, f"{{{NS_SAMLP}}}NameIDPolicy")
        name_id_policy.set("Format", self._config.name_id_format)
        name_id_policy.set("AllowCreate", "true")

        # Serialize, deflate, base64-encode for redirect binding
        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        deflated = zlib.compress(xml_bytes)[2:-4]  # raw deflate (no header/checksum)
        encoded = base64.b64encode(deflated).decode("ascii")

        params: dict[str, str] = {"SAMLRequest": encoded}
        if relay_state:
            params["RelayState"] = relay_state

        redirect_url = f"{self._config.idp_sso_url}?{urlencode(params)}"

        # Track the request for replay protection
        self._pending_requests[request_id] = datetime.now(timezone.utc)
        self._cleanup_old_requests()

        logger.info("SAML AuthnRequest created: id=%s destination=%s", request_id, self._config.idp_sso_url)
        return redirect_url, request_id

    # ── Response processing ──────────────────────────────────────

    def process_response(self, saml_response: str, relay_state: str = "") -> SAMLUser:
        """Process a SAML Response from the IDP.

        Args:
            saml_response: Base64-encoded SAML Response XML.
            relay_state: Optional relay state.

        Returns:
            SAMLUser with identity information.

        Raises:
            ValueError: If the response is invalid or tampered with.
        """
        try:
            xml_bytes = base64.b64decode(saml_response)
        except Exception as exc:
            raise ValueError(f"Invalid base64 in SAML response: {exc}") from exc

        try:
            root = ET.fromstring(xml_bytes)
        except ET.ParseError as exc:
            raise ValueError(f"Malformed SAML response XML: {exc}") from exc

        # Check top-level status
        status_code_el = root.find(f".//{{{NS_SAMLP}}}StatusCode")
        if status_code_el is not None:
            status_value = status_code_el.get("Value", "")
            if "Success" not in status_value:
                raise ValueError(f"SAML response indicates failure: {status_value}")

        # Extract assertion
        assertion = root.find(f".//{{{NS_SAML}}}Assertion")
        if assertion is None:
            raise ValueError("SAML response missing Assertion element")

        # Validate audience restriction
        audience_el = assertion.find(f".//{{{NS_SAML}}}AudienceRestriction/{{{NS_SAML}}}Audience")
        if audience_el is not None and audience_el.text != self._config.entity_id:
            raise ValueError(
                f"Audience mismatch: expected {self._config.entity_id}, got {audience_el.text}"
            )

        # Validate conditions (timestamps)
        conditions = assertion.find(f"{{{NS_SAML}}}Conditions")
        if conditions is not None:
            now = datetime.now(timezone.utc)
            not_before_str = conditions.get("NotBefore")
            not_on_or_after_str = conditions.get("NotOnOrAfter")
            if not_before_str:
                not_before = datetime.fromisoformat(not_before_str.replace("Z", "+00:00"))
                # Allow 5 minutes clock skew
                if now < not_before - timedelta(minutes=5):
                    raise ValueError("SAML assertion not yet valid (NotBefore)")
            if not_on_or_after_str:
                not_on_or_after = datetime.fromisoformat(not_on_or_after_str.replace("Z", "+00:00"))
                if now >= not_on_or_after + timedelta(minutes=5):
                    raise ValueError("SAML assertion expired (NotOnOrAfter)")

        # In-Response-To check (replay protection)
        in_response_to = root.get("InResponseTo", "")
        if in_response_to and in_response_to in self._pending_requests:
            del self._pending_requests[in_response_to]

        # Extract NameID (email)
        name_id_el = assertion.find(f".//{{{NS_SAML}}}Subject/{{{NS_SAML}}}NameID")
        email = name_id_el.text.strip() if name_id_el is not None and name_id_el.text else ""

        # Extract session index from AuthnStatement
        authn_statement = assertion.find(f"{{{NS_SAML}}}AuthnStatement")
        session_index = authn_statement.get("SessionIndex", "") if authn_statement is not None else ""

        # Extract attributes
        attributes: dict[str, list[str]] = {}
        for attr_stmt in assertion.findall(f".//{{{NS_SAML}}}AttributeStatement/{{{NS_SAML}}}Attribute"):
            attr_name = attr_stmt.get("Name", "")
            values = [
                v.text or ""
                for v in attr_stmt.findall(f"{{{NS_SAML}}}AttributeValue")
            ]
            if attr_name:
                attributes[attr_name] = values

        # Build user
        name = ""
        name_keys = [
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
            "displayName",
            "cn",
            "urn:oid:2.16.840.1.113730.3.1.241",
        ]
        for key in name_keys:
            if key in attributes and attributes[key]:
                name = attributes[key][0]
                break

        groups: list[str] = []
        group_keys = [
            "http://schemas.xmlsoap.org/claims/Group",
            "memberOf",
            "groups",
        ]
        for key in group_keys:
            if key in attributes:
                groups.extend(attributes[key])
                break

        user = SAMLUser(
            email=email,
            name=name,
            groups=groups,
            attributes={k: v[0] if len(v) == 1 else v for k, v in attributes.items()},
            session_index=session_index,
        )

        logger.info("SAML response processed: email=%s groups=%s", user.email, user.groups)
        return user

    # ── Logout request ───────────────────────────────────────────

    def create_logout_request(self, name_id: str, session_index: str) -> str:
        """Create a SAML LogoutRequest URL (HTTP-Redirect binding).

        Args:
            name_id: The NameID of the user being logged out.
            session_index: The SessionIndex from the original AuthnStatement.

        Returns:
            Redirect URL for the IDP SLO endpoint.
        """
        request_id = f"_lo_slo_{uuid.uuid4().hex}"
        issue_instant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        root = ET.Element(f"{{{NS_SAMLP}}}LogoutRequest")
        root.set("ID", request_id)
        root.set("Version", "2.0")
        root.set("IssueInstant", issue_instant)
        root.set("Destination", self._config.idp_slo_url)

        issuer = ET.SubElement(root, f"{{{NS_SAML}}}Issuer")
        issuer.text = self._config.entity_id

        name_id_el = ET.SubElement(root, f"{{{NS_SAML}}}NameID")
        name_id_el.set("Format", self._config.name_id_format)
        name_id_el.text = name_id

        if session_index:
            si_el = ET.SubElement(root, f"{{{NS_SAMLP}}}SessionIndex")
            si_el.text = session_index

        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        deflated = zlib.compress(xml_bytes)[2:-4]
        encoded = base64.b64encode(deflated).decode("ascii")

        redirect_url = f"{self._config.idp_slo_url}?{urlencode({'SAMLRequest': encoded})}"

        logger.info("SAML LogoutRequest created: id=%s name_id=%s", request_id, name_id)
        return redirect_url

    # ── SP Metadata ──────────────────────────────────────────────

    def get_metadata_xml(self) -> str:
        """Generate SP metadata XML for IDP configuration.

        Returns:
            XML string suitable for serving at ``/saml/metadata``.
        """
        root = ET.Element(f"{{{NS_MD}}}EntityDescriptor")
        root.set("entityID", self._config.entity_id)

        sp_sso = ET.SubElement(root, f"{{{NS_MD}}}SPSSODescriptor")
        sp_sso.set("protocolSupportEnumeration", NS_SAMLP)
        sp_sso.set("AuthnRequestsSigned", "true" if self._config.sp_certificate else "false")
        sp_sso.set("WantAssertionsSigned", str(self._config.want_assertions_signed).lower())

        # NameID format
        name_id_format_el = ET.SubElement(sp_sso, f"{{{NS_MD}}}NameIDFormat")
        name_id_format_el.text = self._config.name_id_format

        # ACS endpoint (POST binding)
        acs = ET.SubElement(sp_sso, f"{{{NS_MD}}}AssertionConsumerService")
        acs.set("Binding", "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST")
        acs.set("Location", self._config.acs_url)
        acs.set("index", "0")
        acs.set("isDefault", "true")

        # SLO endpoint (redirect binding) if configured
        if self._config.slo_url:
            slo = ET.SubElement(sp_sso, f"{{{NS_MD}}}SingleLogoutService")
            slo.set("Binding", "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect")
            slo.set("Location", self._config.slo_url)

        # SP certificate (if provided)
        if self._config.sp_certificate:
            key_desc = ET.SubElement(sp_sso, f"{{{NS_MD}}}KeyDescriptor")
            key_desc.set("use", "signing")
            key_info = ET.SubElement(key_desc, f"{{{NS_DS}}}KeyInfo")
            x509_data = ET.SubElement(key_info, f"{{{NS_DS}}}X509Data")
            x509_cert = ET.SubElement(x509_data, f"{{{NS_DS}}}X509Certificate")
            # Strip PEM headers and whitespace
            cert_body = (
                self._config.sp_certificate
                .replace("-----BEGIN CERTIFICATE-----", "")
                .replace("-----END CERTIFICATE-----", "")
                .replace("\n", "")
                .strip()
            )
            x509_cert.text = cert_body

        ET.indent(root, space="  ")
        return ET.tostring(root, encoding="unicode", xml_declaration=True)

    # ── Internals ────────────────────────────────────────────────

    def _cleanup_old_requests(self) -> None:
        """Remove pending request IDs older than 10 minutes."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        expired = [rid for rid, ts in self._pending_requests.items() if ts < cutoff]
        for rid in expired:
            del self._pending_requests[rid]
