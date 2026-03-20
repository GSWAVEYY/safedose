/**
 * CaregivingScreen
 *
 * Tabbed dashboard with three sections:
 *  1. "As Patient" — caregivers linked to you + invite button
 *  2. "As Caregiver" — patients you're monitoring + adherence summary
 *  3. Feed — recent dose events from all patients
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Users, Heart, UserPlus } from 'lucide-react-native';
import { useCaregivingStore, type DoseFeedEvent } from '../../../store/caregiving';
import { RelationshipCard } from '../../../components/caregiving/RelationshipCard';
import { InviteSheet } from '../../../components/caregiving/InviteSheet';
import { BurnoutRiskCard } from '../../../components/caregiving/BurnoutRiskCard';
import { Button } from '../../../components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'patient' | 'caregiver' | 'feed';

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({
  message,
  subtext,
  action,
  icon,
}: {
  message: string;
  subtext?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <View className="items-center py-12 px-6">
      <View className="w-14 h-14 rounded-full bg-violet-50 items-center justify-center mb-3">
        {icon ?? <Users size={28} color="#8B5CF6" aria-hidden={true} />}
      </View>
      <Text className="text-slate-600 font-semibold text-base text-center">{message}</Text>
      {subtext && (
        <Text className="text-slate-400 text-sm text-center mt-1">{subtext}</Text>
      )}
      {action && <View className="mt-4 w-full">{action}</View>}
    </View>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-center gap-3"
      accessibilityRole="alert"
    >
      <Text className="flex-1 text-sm text-red-600">{message}</Text>
      <Pressable
        onPress={onRetry}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        className="px-3 py-1.5 bg-red-100 rounded-lg"
      >
        <Text className="text-xs font-semibold text-red-600">{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

function FeedEventRow({ event }: { event: DoseFeedEvent }) {
  const { t } = useTranslation();

  const EVENT_COLORS: Record<string, string> = {
    taken: 'bg-emerald-100 text-emerald-700',
    missed: 'bg-red-100 text-red-700',
    skipped: 'bg-amber-100 text-amber-700',
    late: 'bg-orange-100 text-orange-700',
    scheduled: 'bg-slate-100 text-slate-600',
    caregiver_confirmed: 'bg-teal-100 text-teal-700',
  };

  const colorClass = EVENT_COLORS[event.eventType] ?? 'bg-slate-100 text-slate-600';
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className="bg-white rounded-xl p-3 mb-2 flex-row items-center gap-3">
      {/* Event type badge */}
      <View className={`px-2 py-1 rounded-lg ${colorClass.split(' ')[0]}`}>
        <Text className={`text-xs font-semibold ${colorClass.split(' ')[1]}`}>
          {t(`caregiving.feed.eventType.${event.eventType}`, {
            defaultValue: event.eventType,
          })}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-sm font-medium text-slate-800" numberOfLines={1}>
          {event.medicationName}
        </Text>
        <Text className="text-xs text-slate-500">{event.patientName}</Text>
      </View>

      <Text className="text-xs text-slate-400">{time}</Text>
    </View>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

interface TabBarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

function TabBar({ active, onSelect }: TabBarProps) {
  const { t } = useTranslation();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'patient', label: t('caregiving.tabPatient') },
    { key: 'caregiver', label: t('caregiving.tabCaregiver') },
    { key: 'feed', label: t('caregiving.tabFeed') },
  ];

  return (
    <View
      className="flex-row bg-slate-100 mx-4 rounded-xl p-1 mb-4"
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onSelect(tab.key)}
          accessible
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab.key }}
          accessibilityLabel={tab.label}
          className={`flex-1 py-2 rounded-lg items-center ${
            active === tab.key ? 'bg-white shadow-sm' : ''
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              active === tab.key ? 'text-slate-800' : 'text-slate-500'
            }`}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CaregivingScreen() {
  const { t } = useTranslation();
  const { relationships, feed, isLoading, error, loadRelationships, loadFeed, clearError } =
    useCaregivingStore();

  const [activeTab, setActiveTab] = useState<Tab>('patient');
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  // Split relationships by perspective
  const asPatient = relationships.filter((r) => r.perspective === 'patient');
  const asCaregiver = relationships.filter((r) => r.perspective === 'caregiver');

  // Initial load
  useEffect(() => {
    void loadRelationships();
    void loadFeed();
  }, [loadRelationships, loadFeed]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRelationships(), loadFeed()]);
    setRefreshing(false);
  }, [loadRelationships, loadFeed]);

  const handleRetry = useCallback(() => {
    clearError();
    void loadRelationships();
    void loadFeed();
  }, [clearError, loadRelationships, loadFeed]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" style={{ backgroundColor: 'rgba(139,92,246,0.06)' }}>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center gap-2 mb-1">
          <Users size={22} color="#8B5CF6" aria-hidden={true} />
          <Text className="text-2xl font-bold text-slate-800">
            {t('tabs.caregiving')}
          </Text>
        </View>
        <Text className="text-sm text-slate-500 mt-0.5">
          {t('caregiving.headerSubtext')}
        </Text>
      </View>

      <TabBar active={activeTab} onSelect={setActiveTab} />

      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={handleRetry} />}

      {/* Loading skeleton on first fetch */}
      {isLoading && !refreshing && relationships.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text className="text-slate-400 text-sm mt-3">{t('common.loading')}</Text>
        </View>
      )}

      {/* Tab content */}
      {(!isLoading || refreshing || relationships.length > 0) && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#14B8A6"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── As Patient ── */}
          {activeTab === 'patient' && (
            <>
              {asPatient.length === 0 ? (
                <EmptyState
                  message={t('caregiving.noCaregivers')}
                  subtext={t('caregiving.noCaregiversSubtext')}
                  icon={<UserPlus size={28} color="#8B5CF6" aria-hidden={true} />}
                  action={
                    <Button
                      label={t('caregiving.inviteCaregiver')}
                      variant="primary"
                      onPress={() => setShowInviteSheet(true)}
                      accessibilityLabel={t('caregiving.inviteCaregiverLabel')}
                    />
                  }
                />
              ) : (
                <>
                  {asPatient.map((rel, index) => (
                    <Animated.View
                      key={rel.id}
                      entering={FadeInDown.delay(index * 50).springify()}
                    >
                      <RelationshipCard
                        relationship={rel}
                        canEditPermissions
                      />
                    </Animated.View>
                  ))}
                  <Animated.View
                    entering={FadeInDown.delay(asPatient.length * 50).springify()}
                    className="mt-2"
                  >
                    <Button
                      label={t('caregiving.inviteCaregiver')}
                      variant="secondary"
                      onPress={() => setShowInviteSheet(true)}
                      accessibilityLabel={t('caregiving.inviteCaregiverLabel')}
                    />
                  </Animated.View>
                </>
              )}
            </>
          )}

          {/* ── As Caregiver ── */}
          {activeTab === 'caregiver' && (
            <>
              {asCaregiver.length === 0 ? (
                <EmptyState
                  message={t('caregiving.noPatients')}
                  subtext={t('caregiving.noPatientsSubtext')}
                  icon={<Heart size={28} color="#8B5CF6" aria-hidden={true} />}
                />
              ) : (
                <>
                  {/* Burnout prevention card — only visible when actively caregiving */}
                  <Animated.View entering={FadeInDown.delay(0).springify()}>
                    <BurnoutRiskCard />
                  </Animated.View>
                  {asCaregiver.map((rel, index) => (
                    <Animated.View
                      key={rel.id}
                      entering={FadeInDown.delay((index + 1) * 50).springify()}
                    >
                      <RelationshipCard
                        relationship={rel}
                        canEditPermissions={false}
                      />
                    </Animated.View>
                  ))}
                </>
              )}
            </>
          )}

          {/* ── Feed ── */}
          {activeTab === 'feed' && (
            <>
              {feed.length === 0 ? (
                <EmptyState
                  message={t('caregiving.noFeedEvents')}
                  subtext={t('caregiving.noFeedEventsSubtext')}
                />
              ) : (
                feed.map((event, index) => (
                  <Animated.View
                    key={event.id}
                    entering={FadeInDown.delay(index * 50).springify()}
                  >
                    <FeedEventRow event={event} />
                  </Animated.View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Invite sheet */}
      <InviteSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
      />
    </SafeAreaView>
  );
}
