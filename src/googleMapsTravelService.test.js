import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTravelLookupMessage } from './googleMapsTravelService.js';

test('returns configuration guidance when the Google Maps key is missing', () => {
  const message = buildTravelLookupMessage({
    apiKeyFound: false,
    isLoaded: false,
    error: new Error('missing key'),
  });

  assert.match(message, /not configured/i);
  assert.match(message, /manual miles/i);
});

test('returns billing and restriction guidance for timeout or routing failures', () => {
  const message = buildTravelLookupMessage({
    apiKeyFound: true,
    isLoaded: true,
    error: new Error('Google callback did not return'),
  });

  assert.match(message, /could not calculate the route|manual miles/i);
});
