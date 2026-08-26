import React from 'react';

/**
 * Legacy compatibility export.
 * The market ticker now lives directly inside Header via HeaderMarketTicker.
 * Keeping this component as a no-op prevents duplicate polling, duplicate DOM
 * mounts, and legacy portal behavior for older imports.
 */
export const MemeTicker: React.FC<{ global?: boolean }> = () => null;
