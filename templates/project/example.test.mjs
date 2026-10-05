import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectType } from './example.mjs';
test('demonstration identifies itself honestly', () => assert.equal(projectType, 'synthetic-example'));
