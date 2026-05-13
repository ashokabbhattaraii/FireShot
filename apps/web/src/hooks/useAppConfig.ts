'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'

interface PublicAppConfig {
  APP_MAINTENANCE_MODE?: string
  MAINTENANCE_MODE?: string
  APP_MAINTENANCE_ENABLED?: string
  APP_MAINTENANCE_MESSAGE?: string
  APP_ANNOUNCEMENT_ACTIVE?: string
  APP_ANNOUNCEMENT_TEXT?: string
  APP_ANNOUNCEMENT_COLOR?: string
  APP_WITHDRAW_ENABLED?: string
  APP_DEPOSIT_ENABLED?: string
  APP_CHALLENGE_ENABLED?: string
  APP_TOURNAMENT_JOIN_ENABLED?: string
  APP_LOGIN_MESSAGE?: string
  APP_HOME_NOTICE?: string
  APP_REGISTRATION_OPEN?: string
  APP_FORCE_UPDATE_VERSION?: string
  maintenance?: {
    enabled?: boolean
    message?: string
  }
  announcement?: {
    active?: boolean
    text?: string
    color?: string
  }
}

function flag(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

export function useAppConfig() {
  const { data } = useSWR<PublicAppConfig>('/app/config', {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    fetcher: (url: string) => api(url),
  })

  const maintenanceMode =
    flag(data?.maintenance?.enabled) ||
    flag(data?.APP_MAINTENANCE_ENABLED) ||
    flag(data?.APP_MAINTENANCE_MODE) ||
    flag(data?.MAINTENANCE_MODE)

  return {
    maintenanceMode,
    maintenanceMessage: data?.maintenance?.message ?? data?.APP_MAINTENANCE_MESSAGE ?? '',
    announcementActive: flag(data?.announcement?.active) || flag(data?.APP_ANNOUNCEMENT_ACTIVE),
    announcementText: data?.announcement?.text ?? data?.APP_ANNOUNCEMENT_TEXT ?? '',
    announcementColor: data?.announcement?.color ?? data?.APP_ANNOUNCEMENT_COLOR ?? '#E53935',
    withdrawEnabled: data?.APP_WITHDRAW_ENABLED !== 'false',
    depositEnabled: data?.APP_DEPOSIT_ENABLED !== 'false',
    challengeEnabled: data?.APP_CHALLENGE_ENABLED !== 'false',
    tournamentJoinEnabled: data?.APP_TOURNAMENT_JOIN_ENABLED !== 'false',
    loginMessage: data?.APP_LOGIN_MESSAGE ?? '',
    homeNotice: data?.APP_HOME_NOTICE ?? '',
    registrationOpen: data?.APP_REGISTRATION_OPEN !== 'false',
    forceUpdateVersion: data?.APP_FORCE_UPDATE_VERSION ?? '',
  }
}
