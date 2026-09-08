import { ChannelProvider } from '@prisma/client';

export type ChannelCapability = 'AVAILABILITY_READ' | 'AVAILABILITY_WRITE' | 'RESERVATIONS_READ' | 'LISTING_WRITE' | 'RATES_WRITE';

export type ChannelAdapter = {
  provider: ChannelProvider;
  capabilities: ChannelCapability[];
  mode: 'ICAL' | 'PARTNER_API' | 'CHANNEL_MANAGER';
};

export const CHANNEL_ADAPTERS: Record<ChannelProvider, ChannelAdapter> = {
  ICAL: {
    provider: 'ICAL',
    mode: 'ICAL',
    capabilities: ['AVAILABILITY_READ', 'RESERVATIONS_READ'],
  },
  AIRBNB: {
    provider: 'AIRBNB',
    mode: 'PARTNER_API',
    capabilities: ['AVAILABILITY_READ', 'AVAILABILITY_WRITE', 'RESERVATIONS_READ', 'LISTING_WRITE', 'RATES_WRITE'],
  },
  BOOKING_COM: {
    provider: 'BOOKING_COM',
    mode: 'PARTNER_API',
    capabilities: ['AVAILABILITY_READ', 'AVAILABILITY_WRITE', 'RESERVATIONS_READ', 'LISTING_WRITE', 'RATES_WRITE'],
  },
  CHANNEL_MANAGER: {
    provider: 'CHANNEL_MANAGER',
    mode: 'CHANNEL_MANAGER',
    capabilities: ['AVAILABILITY_READ', 'AVAILABILITY_WRITE', 'RESERVATIONS_READ', 'LISTING_WRITE', 'RATES_WRITE'],
  },
};

export function getChannelAdapter(provider: ChannelProvider) {
  return CHANNEL_ADAPTERS[provider];
}

/**
 * V28 deliberately does not fake direct Airbnb/Booking.com connectivity.
 * Those adapters become active only when Hestiat has an approved partner/API
 * connection and provider-specific credentials/configuration.
 */
export function assertDirectProviderReady(provider: ChannelProvider) {
  if (provider === 'ICAL') return;
  throw new Error(`${provider}: integración directa no configurada; utiliza iCal o un channel manager hasta disponer de acceso de partner.`);
}
