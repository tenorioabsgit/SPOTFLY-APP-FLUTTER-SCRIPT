import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/Colors';
import { Layout } from '../src/constants/Layout';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import LanguageToggle from '../src/components/LanguageToggle';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  function handleLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.logoutConfirm'))) {
        signOut();
      }
    } else {
      Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
        { text: t('profile.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => signOut() },
      ]);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatarLarge}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>
              {(user?.displayName || 'U').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        {/* Language */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="language" size={22} color={Colors.textPrimary} />
            <Text style={styles.settingLabel}>{t('profile.language')}</Text>
          </View>
          <LanguageToggle />
        </View>

        {/* About */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.textPrimary} />
            <Text style={styles.settingLabel}>{t('profile.about')}</Text>
          </View>
        </View>
        <Text style={styles.aboutText}>{t('profile.aboutText')}</Text>

        {/* Version */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="code-slash" size={22} color={Colors.textSecondary} />
            <Text style={styles.settingLabelMuted}>{t('profile.version')} 1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#ff5252" />
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Layout.padding.xl,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Layout.padding.md,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitial: {
    color: Colors.background,
    fontSize: 32,
    fontWeight: '700',
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  userEmail: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  settingsSection: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Layout.padding.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.padding.sm,
  },
  settingLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  settingLabelMuted: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  aboutText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: Layout.padding.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.padding.sm,
    marginHorizontal: Layout.padding.md,
    marginTop: Layout.padding.xl,
    paddingVertical: 14,
    borderRadius: Layout.borderRadius.round,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  logoutText: {
    color: '#ff5252',
    fontSize: 16,
    fontWeight: '600',
  },
});
