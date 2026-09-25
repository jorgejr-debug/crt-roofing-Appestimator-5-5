import { useEffect } from "react";
import { useLoadScript } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "./googleMapsTravelService.js";

export default function DeferredGoogleMapsLoader({ onStatusChange }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    onStatusChange((current) => {
      if (current.isLoaded === isLoaded && current.loadError === loadError) return current;
      return { isLoaded, loadError: loadError || null };
    });
  }, [isLoaded, loadError, onStatusChange]);

  return null;
}
