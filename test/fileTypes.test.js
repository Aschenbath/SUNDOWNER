/**
 * Tests for unified file type detection
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
  computeFileTypeBucket,
  detectBucketFromExtension,
  detectBucketFromMimeType,
  getFileExtension,
  isGenericMimeType,
  isImageFile,
  isVideoFile,
  isAudioFile,
  FILE_TYPE_BUCKETS,
} from '../functions/utils/fileTypes.js';

describe('File Type Detection', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      assert.equal(getFileExtension('photo.jpg'), 'jpg');
      assert.equal(getFileExtension('video.mp4'), 'mp4');
      assert.equal(getFileExtension('song.m4a'), 'm4a');
    });

    it('should handle multiple dots', () => {
      assert.equal(getFileExtension('archive.tar.gz'), 'gz');
      assert.equal(getFileExtension('file.backup.jpg'), 'jpg');
    });

    it('should return empty for no extension', () => {
      assert.equal(getFileExtension('README'), '');
      assert.equal(getFileExtension('file.'), '');
    });

    it('should handle edge cases', () => {
      assert.equal(getFileExtension(''), '');
      assert.equal(getFileExtension(null), '');
      assert.equal(getFileExtension(undefined), '');
    });
  });

  describe('isGenericMimeType', () => {
    it('should identify generic MIME types', () => {
      assert.equal(isGenericMimeType('application/octet-stream'), true);
      assert.equal(isGenericMimeType('binary/octet-stream'), true);
      assert.equal(isGenericMimeType('unknown'), true);
      assert.equal(isGenericMimeType(''), true);
    });

    it('should reject specific MIME types', () => {
      assert.equal(isGenericMimeType('image/jpeg'), false);
      assert.equal(isGenericMimeType('video/mp4'), false);
      assert.equal(isGenericMimeType('audio/mpeg'), false);
    });
  });

  describe('detectBucketFromMimeType', () => {
    it('should detect image MIME types', () => {
      assert.equal(detectBucketFromMimeType('image/jpeg'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromMimeType('image/png'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromMimeType('image'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromMimeType('photo'), FILE_TYPE_BUCKETS.IMAGE);
    });

    it('should detect video MIME types', () => {
      assert.equal(detectBucketFromMimeType('video/mp4'), FILE_TYPE_BUCKETS.VIDEO);
      assert.equal(detectBucketFromMimeType('video/quicktime'), FILE_TYPE_BUCKETS.VIDEO);
      assert.equal(detectBucketFromMimeType('video'), FILE_TYPE_BUCKETS.VIDEO);
    });

    it('should detect audio MIME types', () => {
      assert.equal(detectBucketFromMimeType('audio/mpeg'), FILE_TYPE_BUCKETS.AUDIO);
      assert.equal(detectBucketFromMimeType('audio/mp4'), FILE_TYPE_BUCKETS.AUDIO);
      assert.equal(detectBucketFromMimeType('audio'), FILE_TYPE_BUCKETS.AUDIO);
    });

    it('should return null for unknown types', () => {
      assert.equal(detectBucketFromMimeType('application/pdf'), null);
      assert.equal(detectBucketFromMimeType('text/plain'), null);
    });
  });

  describe('detectBucketFromExtension', () => {
    it('should detect image extensions', () => {
      assert.equal(detectBucketFromExtension('jpg'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromExtension('png'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromExtension('heic'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromExtension('webp'), FILE_TYPE_BUCKETS.IMAGE);
    });

    it('should detect video extensions', () => {
      assert.equal(detectBucketFromExtension('mp4'), FILE_TYPE_BUCKETS.VIDEO);
      assert.equal(detectBucketFromExtension('mov'), FILE_TYPE_BUCKETS.VIDEO);
      assert.equal(detectBucketFromExtension('mkv'), FILE_TYPE_BUCKETS.VIDEO);
    });

    it('should detect audio extensions', () => {
      assert.equal(detectBucketFromExtension('mp3'), FILE_TYPE_BUCKETS.AUDIO);
      assert.equal(detectBucketFromExtension('m4a'), FILE_TYPE_BUCKETS.AUDIO);
      assert.equal(detectBucketFromExtension('flac'), FILE_TYPE_BUCKETS.AUDIO);
    });

    it('should be case insensitive', () => {
      assert.equal(detectBucketFromExtension('JPG'), FILE_TYPE_BUCKETS.IMAGE);
      assert.equal(detectBucketFromExtension('Mp4'), FILE_TYPE_BUCKETS.VIDEO);
      assert.equal(detectBucketFromExtension('MP3'), FILE_TYPE_BUCKETS.AUDIO);
    });

    it('should return null for unknown extensions', () => {
      assert.equal(detectBucketFromExtension('pdf'), null);
      assert.equal(detectBucketFromExtension('txt'), null);
      assert.equal(detectBucketFromExtension('zip'), null);
    });
  });

  describe('computeFileTypeBucket', () => {
    it('should use explicit bucket from metadata', () => {
      const metadata = { FileTypeBucket: 'image' };
      assert.equal(computeFileTypeBucket(metadata), FILE_TYPE_BUCKETS.IMAGE);
    });

    it('should detect from MIME type', () => {
      const metadata = { FileType: 'image/jpeg' };
      assert.equal(computeFileTypeBucket(metadata), FILE_TYPE_BUCKETS.IMAGE);
    });

    it('should fallback to extension for generic MIME', () => {
      const metadata = {
        FileType: 'application/octet-stream',
        FileName: 'photo.jpg',
      };
      assert.equal(computeFileTypeBucket(metadata), FILE_TYPE_BUCKETS.IMAGE);
    });

    it('should use fileId for extension fallback', () => {
      const metadata = { FileType: 'unknown' };
      const fileId = 'path/to/video.mp4';
      assert.equal(computeFileTypeBucket(metadata, fileId), FILE_TYPE_BUCKETS.VIDEO);
    });

    it('should default to other for unknown types', () => {
      const metadata = { FileType: 'application/pdf' };
      assert.equal(computeFileTypeBucket(metadata), FILE_TYPE_BUCKETS.OTHER);
    });

    it('should handle empty metadata', () => {
      assert.equal(computeFileTypeBucket({}), FILE_TYPE_BUCKETS.OTHER);
      assert.equal(computeFileTypeBucket(null), FILE_TYPE_BUCKETS.OTHER);
      assert.equal(computeFileTypeBucket(undefined), FILE_TYPE_BUCKETS.OTHER);
    });
  });

  describe('Type check helpers', () => {
    it('should check if file is image', () => {
      assert.equal(isImageFile({ FileType: 'image/jpeg' }), true);
      assert.equal(isImageFile({ FileType: 'video/mp4' }), false);
    });

    it('should check if file is video', () => {
      assert.equal(isVideoFile({ FileType: 'video/mp4' }), true);
      assert.equal(isVideoFile({ FileType: 'image/jpeg' }), false);
    });

    it('should check if file is audio', () => {
      assert.equal(isAudioFile({ FileType: 'audio/mpeg' }), true);
      assert.equal(isAudioFile({ FileType: 'image/jpeg' }), false);
    });
  });
});
