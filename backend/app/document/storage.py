"""
Local Document Vault Storage Service.

Provides:
- Secure local filesystem storage under uploads/documents/
- UUID filename generation preventing path traversal and collision
- File size validation (max 10 MB default)
- Mime type allowlisting (PDF, PNG, JPEG)
- Empty file prevention
- SHA-256 checksumming for integrity and deduplication tracking
"""
import hashlib
import os
import uuid
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status

# Allowed file types and extensions
ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

DEFAULT_STORAGE_ROOT = Path("uploads/documents")


class DocumentStorageService:
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES

    @classmethod
    def get_storage_root(cls) -> Path:
        root = DEFAULT_STORAGE_ROOT
        root.mkdir(parents=True, exist_ok=True)
        return root

    @classmethod
    def sanitize_display_filename(cls, original_filename: str) -> str:
        """
        Strips directory components and path traversal elements from display filename.
        Preserves normal filenames with spaces, Unicode characters, and valid extensions.
        """
        if not original_filename:
            return "uploaded_document"
        # Extract base name across both POSIX and Windows separators
        clean_name = os.path.basename(original_filename.replace("\\", "/"))
        # Strip leading dots or whitespace
        clean_name = clean_name.strip()
        while clean_name.startswith("."):
            clean_name = clean_name.lstrip(".")
        if not clean_name:
            return "document"
        return clean_name

    @classmethod
    def validate_file(cls, original_filename: str, content: bytes, mime_type: str) -> str:
        """
        Validates basic file constraints:
        - Non-empty
        - Size within limit
        - Extension in allowlist
        - MIME type in allowlist
        Returns the sanitized extension.
        """
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes)",
            )

        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB",
            )

        # Check extension on sanitized filename
        clean_name = cls.sanitize_display_filename(original_filename)
        ext = Path(clean_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{ext}'. Allowed extensions: {list(ALLOWED_EXTENSIONS)}",
            )

        # Check mime type if provided
        norm_mime = (mime_type or "").lower().split(";")[0].strip()
        if norm_mime and norm_mime not in ALLOWED_MIME_TYPES:
            # If standard octet-stream, check extension fallback
            if norm_mime != "application/octet-stream":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported MIME type '{norm_mime}'. Allowed: {list(ALLOWED_MIME_TYPES.keys())}",
                )

        return ext

    @classmethod
    def calculate_checksum(cls, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @classmethod
    def save_file(
        cls,
        original_filename: str,
        content: bytes,
        mime_type: str,
    ) -> Tuple[str, str, int]:
        """
        Validates, checksums, and writes content to a UUID filename in the vault.
        Returns: (storage_filename, checksum_sha256, file_size_bytes)
        """
        ext = cls.validate_file(original_filename, content, mime_type)
        checksum = cls.calculate_checksum(content)

        # Generate internal UUID filename to prevent path traversal and collision
        unique_name = f"{uuid.uuid4().hex}{ext}"
        storage_root = cls.get_storage_root().resolve()
        target_path = (storage_root / unique_name).resolve()

        # Guard against path traversal with strict relative_to containment
        try:
            target_path.relative_to(storage_root)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage path detected",
            )

        if target_path == storage_root:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage path detected",
            )

        with open(target_path, "wb") as f:
            f.write(content)

        return unique_name, checksum, len(content)

    @classmethod
    def get_file_path(cls, storage_filename: str) -> Path:
        """
        Returns the resolved file path ensuring it stays strictly inside the storage root.
        Rejects directory separators, parent references, drive specifiers, and prefix bypasses.
        """
        if not storage_filename or not isinstance(storage_filename, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: path traversal detected",
            )

        # Reject path separators, parent dir references, and drive specifiers
        if "/" in storage_filename or "\\" in storage_filename or ".." in storage_filename or ":" in storage_filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: path traversal detected",
            )

        storage_root = cls.get_storage_root().resolve()
        file_path = (storage_root / storage_filename).resolve()

        # Strict containment check using relative_to (prevents prefix matching bypass)
        try:
            file_path.relative_to(storage_root)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: path traversal detected",
            )

        if file_path == storage_root:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: invalid document path",
            )

        if not file_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found in storage vault",
            )

        return file_path

    @classmethod
    def delete_file(cls, storage_filename: str) -> bool:
        """
        Safely deletes a file from the vault (e.g. during transaction rollback cleanup).
        Returns True if deleted, False if file was not present or unlinked.
        """
        if (
            not storage_filename
            or not isinstance(storage_filename, str)
            or "/" in storage_filename
            or "\\" in storage_filename
            or ".." in storage_filename
            or ":" in storage_filename
        ):
            return False
        try:
            storage_root = cls.get_storage_root().resolve()
            file_path = (storage_root / storage_filename).resolve()
            file_path.relative_to(storage_root)
            if file_path != storage_root and file_path.is_file():
                file_path.unlink(missing_ok=True)
                return True
        except Exception:
            pass
        return False
