"""S3-compatible object storage (MinIO locally) for chat attachments and case documents.

Configured from the environment (see .env.example). When S3_ENDPOINT_URL is not set,
`ObjectStorage.from_env()` returns None and the app falls back to keeping attachments in SQLite.
"""
import logging
import os
from dataclasses import dataclass
from urllib.parse import quote, unquote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class StorageError(Exception):
    pass


class ObjectNotFound(StorageError):
    pass


@dataclass(frozen = True)
class StoredObject:
    data: bytes
    content_type: str
    filename: str | None


class ObjectStorage:
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, region: str = 'us-east-1',
                 attachments_bucket: str = 'zusia-attachments', cases_bucket: str = 'zusia-cases'):
        self.attachments_bucket = attachments_bucket
        self.cases_bucket = cases_bucket
        self.client = boto3.client('s3',
                                   endpoint_url = endpoint_url,
                                   aws_access_key_id = access_key,
                                   aws_secret_access_key = secret_key,
                                   region_name = region,
                                   config = Config(signature_version = 's3v4',
                                                   s3 = {'addressing_style': 'path'},
                                                   retries = {'max_attempts': 3, 'mode': 'standard'},
                                                   connect_timeout = 5,
                                                   read_timeout = 30))

    @classmethod
    def from_env(cls) -> 'ObjectStorage | None':
        endpoint = os.getenv('S3_ENDPOINT_URL')
        if not endpoint:
            logger.info('S3_ENDPOINT_URL is not set – object storage disabled')
            return None
        access_key = os.getenv('S3_ACCESS_KEY')
        secret_key = os.getenv('S3_SECRET_KEY')
        if not access_key or not secret_key:
            raise RuntimeError('S3_ACCESS_KEY and S3_SECRET_KEY are required when S3_ENDPOINT_URL is set')
        storage = cls(endpoint, access_key, secret_key,
                      region = os.getenv('S3_REGION', 'us-east-1'),
                      attachments_bucket = os.getenv('S3_BUCKET_ATTACHMENTS', 'zusia-attachments'),
                      cases_bucket = os.getenv('S3_BUCKET_CASES', 'zusia-cases'))
        try:
            storage.ensure_buckets()
        except (BotoCoreError, ClientError):
            # Don't block API start-up if MinIO is not up yet – uploads will retry and fall back.
            logger.exception('Object storage at %s is not reachable', endpoint)
        return storage

    def ensure_buckets(self) -> None:
        """Create the buckets if they don't exist (docker compose's minio-init normally does this)."""
        for bucket in (self.attachments_bucket, self.cases_bucket):
            try:
                self.client.head_bucket(Bucket = bucket)
            except ClientError as exc:
                if exc.response.get('Error', {}).get('Code') in ('404', 'NoSuchBucket', 'NotFound'):
                    self.client.create_bucket(Bucket = bucket)
                    logger.info('Created bucket %s', bucket)
                else:
                    raise

    def put(self, bucket: str, key: str, data: bytes, content_type: str, filename: str | None = None) -> None:
        # S3 metadata must be ASCII – keep the original (possibly Polish) file name URL-encoded.
        metadata = {'filename': quote(filename)} if filename else {}
        try:
            self.client.put_object(Bucket = bucket, Key = key, Body = data, ContentType = content_type,
                                   Metadata = metadata)
        except (BotoCoreError, ClientError) as exc:
            raise StorageError(f'Could not store {bucket}/{key}') from exc

    def get(self, bucket: str, key: str) -> StoredObject:
        try:
            obj = self.client.get_object(Bucket = bucket, Key = key)
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') in ('NoSuchKey', '404', 'NotFound'):
                raise ObjectNotFound(key) from exc
            raise StorageError(f'Could not read {bucket}/{key}') from exc
        except BotoCoreError as exc:
            raise StorageError(f'Could not read {bucket}/{key}') from exc
        filename = obj.get('Metadata', {}).get('filename')
        return StoredObject(data = obj['Body'].read(),
                            content_type = obj.get('ContentType') or 'application/octet-stream',
                            filename = unquote(filename) if filename else None)

    def delete_prefix(self, bucket: str, prefix: str) -> int:
        """Delete every object under `prefix`. Returns the number of deleted objects."""
        deleted = 0
        try:
            paginator = self.client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket = bucket, Prefix = prefix):
                keys = [{'Key': o['Key']} for o in page.get('Contents', [])]
                if keys:
                    self.client.delete_objects(Bucket = bucket, Delete = {'Objects': keys, 'Quiet': True})
                    deleted += len(keys)
        except (BotoCoreError, ClientError) as exc:
            raise StorageError(f'Could not delete {bucket}/{prefix}') from exc
        return deleted
