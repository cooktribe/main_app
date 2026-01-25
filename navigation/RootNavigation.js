import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

// Pending navigation for cold starts
let pendingRoute = null;

export function safeNavigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    pendingRoute = { name, params };
  }
}

export function flushPendingNavigation() {
  if (pendingRoute && navigationRef.isReady()) {
    const { name, params } = pendingRoute;
    pendingRoute = null;
    navigationRef.navigate(name, params);
  }
}


