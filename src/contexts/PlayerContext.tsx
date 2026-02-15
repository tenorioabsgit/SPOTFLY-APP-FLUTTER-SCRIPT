import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Track, RepeatMode } from '../types';
import { getOfflinePath } from '../services/offlineStorage';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track, trackList?: Track[]) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType>({} as PlayerContextType);

export function usePlayer() {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    setupAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  async function setupAudio() {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });
    } catch (e) {
      console.error('Error setting up audio:', e);
    }
  }

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis / 1000);
    setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      handleTrackFinish();
    }
  }, [queue, queueIndex, repeat, shuffle]);

  async function handleTrackFinish() {
    if (repeat === 'one') {
      await soundRef.current?.replayAsync();
      return;
    }

    const nextIndex = getNextIndex();
    if (nextIndex !== -1) {
      await loadAndPlayTrack(queue[nextIndex], nextIndex);
    } else {
      setIsPlaying(false);
      setPosition(0);
    }
  }

  function getNextIndex(): number {
    if (shuffle) {
      const remaining = queue
        .map((_, i) => i)
        .filter(i => i !== queueIndex);
      if (remaining.length === 0) {
        return repeat === 'all' ? Math.floor(Math.random() * queue.length) : -1;
      }
      return remaining[Math.floor(Math.random() * remaining.length)];
    }

    const next = queueIndex + 1;
    if (next >= queue.length) {
      return repeat === 'all' ? 0 : -1;
    }
    return next;
  }

  async function loadAndPlayTrack(track: Track, index: number) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      if (!track.audioUrl) {
        // For tracks without audio URLs, simulate playback
        setCurrentTrack(track);
        setQueueIndex(index);
        setPosition(0);
        setDuration(track.duration);
        setIsPlaying(true);

        // Simulate progress
        const interval = setInterval(() => {
          setPosition(prev => {
            if (prev >= track.duration) {
              clearInterval(interval);
              handleTrackFinish();
              return 0;
            }
            return prev + 1;
          });
        }, 1000);

        soundRef.current = null;
        return;
      }

      // Check for offline version first
      const offlinePath = await getOfflinePath(track.id);
      const audioUri = offlinePath || track.audioUrl;

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setCurrentTrack(track);
      setQueueIndex(index);
      setIsPlaying(true);
    } catch (e) {
      console.error('Error loading track:', e);
      // Still set the track info even if audio fails
      setCurrentTrack(track);
      setQueueIndex(index);
      setDuration(track.duration);
    }
  }

  async function playTrack(track: Track, trackList?: Track[]) {
    const newQueue = trackList || [track];
    const index = newQueue.findIndex(t => t.id === track.id);
    setQueue(newQueue);
    await loadAndPlayTrack(track, index >= 0 ? index : 0);
  }

  async function playQueue(tracks: Track[], startIndex = 0) {
    if (tracks.length === 0) return;
    setQueue(tracks);
    await loadAndPlayTrack(tracks[startIndex], startIndex);
  }

  async function togglePlay() {
    if (!soundRef.current) {
      setIsPlaying(prev => !prev);
      return;
    }
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  }

  async function nextTrack() {
    const nextIdx = getNextIndex();
    if (nextIdx !== -1 && queue[nextIdx]) {
      await loadAndPlayTrack(queue[nextIdx], nextIdx);
    }
  }

  async function previousTrack() {
    if (position > 3) {
      // If more than 3 seconds in, restart current track
      await seekTo(0);
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0 && queue[prevIdx]) {
      await loadAndPlayTrack(queue[prevIdx], prevIdx);
    }
  }

  async function seekTo(pos: number) {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(pos * 1000);
    }
    setPosition(pos);
  }

  function toggleShuffle() {
    setShuffle(prev => !prev);
  }

  function toggleRepeat() {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }

  function addToQueue(track: Track) {
    setQueue(prev => [...prev, track]);
  }

  function removeFromQueue(index: number) {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => prev - 1);
    }
  }

  function clearQueue() {
    setQueue(currentTrack ? [currentTrack] : []);
    setQueueIndex(0);
  }

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        queueIndex,
        position,
        duration,
        shuffle,
        repeat,
        playTrack,
        playQueue,
        togglePlay,
        nextTrack,
        previousTrack,
        seekTo,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        removeFromQueue,
        clearQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
