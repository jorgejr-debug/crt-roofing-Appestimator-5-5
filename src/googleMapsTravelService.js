export const GOOGLE_MAPS_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  "";
export const GOOGLE_MAPS_LIBRARIES = ["places"];

export function buildTravelLookupMessage({ apiKeyFound, isLoaded, loadError, error, originAddress, destinationAddress }) {
  if (!apiKeyFound) {
    return "Google Maps is not configured. You can still enter manual miles.";
  }

  if (loadError) {
    return "Google Maps is unavailable right now. You can still enter manual miles.";
  }

  if (!isLoaded) {
    return "Google Maps is still loading. Please try again in a moment.";
  }

  if (error) {
    return "Google Maps could not calculate the route. Please try again or enter manual miles.";
  }

  const routeInfo = [];
  if (originAddress) routeInfo.push(`Origin: ${originAddress}`);
  if (destinationAddress) routeInfo.push(`Destination: ${destinationAddress}`);
  return routeInfo.length > 0 ? `Google Maps ready. ${routeInfo.join(" | ")}` : "Google Maps ready. Enter an address and calculate distance.";
}

export async function geocodeGoogleAddress(address) {
  if (!window.google?.maps?.Geocoder) {
    throw new Error("Google Maps API unavailable for Geocoder.");
  }

  return new Promise((resolve, reject) => {
    const geocoder = new window.google.maps.Geocoder();
    let completed = false;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      reject(new Error("Google Geocoder callback did not return."));
    }, 10000);

    geocoder.geocode({ address }, (results, status) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (completed) return;
      completed = true;

      const location = results?.[0]?.geometry?.location || null;
      if (status === "OK" && location) {
        resolve({
          status,
          location,
          formattedAddress: results?.[0]?.formatted_address || address,
        });
        return;
      }

      reject(new Error(`Geocoder status: ${status}`));
    });
  });
}

export async function routeGoogleDirections(originAddress, destinationAddress, timeoutLabel = "Google Directions") {
  if (!window.google?.maps?.DirectionsService) {
    throw new Error("Google Maps API unavailable for DirectionsService.");
  }

  const [{ location: originLocation, formattedAddress: resolvedOrigin }, { location: destinationLocation, formattedAddress: resolvedDestination }] =
    await Promise.all([geocodeGoogleAddress(originAddress), geocodeGoogleAddress(destinationAddress)]);

  const directionsService = new window.google.maps.DirectionsService();
  return new Promise((resolve, reject) => {
    let completed = false;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      reject(new Error(`${timeoutLabel}: Google callback did not return. Check billing, browser blocker, API restrictions, or Google Cloud billing activation.`));
    }, 15000);

    directionsService.route(
      {
        origin: originLocation,
        destination: destinationLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (completed) return;
        completed = true;

        if (status === window.google.maps.DirectionsStatus.OK && response?.routes?.[0]?.legs?.[0]) {
          resolve({
            status,
            response,
            originAddress: resolvedOrigin,
            destinationAddress: resolvedDestination,
          });
          return;
        }

        reject(new Error(`Google Directions failed: ${status}`));
      },
    );
  });
}

export async function routeGoogleDirectionsDirect(originAddress, destinationAddress, timeoutLabel = "Google Directions") {
  if (!window.google?.maps?.DirectionsService) {
    throw new Error("Google Maps API unavailable for DirectionsService.");
  }

  const directionsService = new window.google.maps.DirectionsService();
  return new Promise((resolve, reject) => {
    let completed = false;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      reject(new Error(`${timeoutLabel}: Google callback did not return. Check billing, browser blocker, API restrictions, or Google Cloud billing activation.`));
    }, 15000);

    directionsService.route(
      {
        origin: originAddress,
        destination: destinationAddress,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (completed) return;
        completed = true;

        if (status === window.google.maps.DirectionsStatus.OK && response?.routes?.[0]?.legs?.[0]) {
          resolve({
            status,
            response,
            originAddress,
            destinationAddress,
          });
          return;
        }

        reject(new Error(`Google Directions failed: ${status}`));
      },
    );
  });
}

function normalizePlaceSuggestions(result) {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    return result.map((item) => (item?.description || item?.displayName || item?.name || "")).filter(Boolean);
  }

  const predictions = result.predictions || result.suggestions || result.results || result.placePredictions || [];
  if (Array.isArray(predictions)) {
    return predictions.map((prediction) => (prediction?.description || prediction?.displayName || prediction?.name || "")).filter(Boolean);
  }

  return [];
}

async function fetchNewPlacesAutocomplete(input) {
  const AutocompleteSuggestion = window.google?.maps?.places?.AutocompleteSuggestion;
  if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    throw new Error("Google Places AutocompleteSuggestion is unavailable. Ensure the new Places API is enabled.");
  }

  const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input });
  return normalizePlaceSuggestions(response);
}

async function fetchLegacyPlacePredictions(input) {
  if (!window.google?.maps?.places?.AutocompleteService) {
    throw new Error("Google Places AutocompleteService is unavailable. Ensure the Places library is loaded.");
  }

  return new Promise((resolve, reject) => {
    const autocompleteService = new window.google.maps.places.AutocompleteService();
    let completed = false;
    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      reject(new Error("Places suggestions callback did not return."));
    }, 10000);

    autocompleteService.getPlacePredictions({ input, componentRestrictions: { country: "us" } }, (predictions, status) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (completed) return;
      completed = true;

      if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(predictions)) {
        resolve(predictions.map((prediction) => prediction.description || "").filter(Boolean));
        return;
      }

      resolve([]);
    });
  });
}

export async function fetchPlacePredictions(input) {
  if (!input || String(input).trim().length < 3) {
    return [];
  }

  const trimmed = String(input).trim();
  const errors = [];

  if (window.google?.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    try {
      const predictions = await fetchNewPlacesAutocomplete(trimmed);
      if (predictions.length) {
        return predictions;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (window.google?.maps?.places?.AutocompleteService) {
    try {
      const predictions = await fetchLegacyPlacePredictions(trimmed);
      if (predictions.length) {
        return predictions;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Google Places autocomplete is unavailable. ${errors.length ? 'Details: ' + errors.join(' | ') : 'Enable the new Places API (places.googleapis.com) or the legacy Places API in the same Google Cloud project.'}`,
  );
}
