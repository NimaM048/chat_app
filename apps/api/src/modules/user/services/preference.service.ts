import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { UpdatePreferencesDto } from '../dto/update-profile.dto';

@Injectable()
export class PreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePreferences(userId: string) {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    if (existing) return this.mapPreferences(existing);

    const created = await this.prisma.userPreference.create({
      data: { userId },
    });
    return this.mapPreferences(created);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.getOrCreatePreferences(userId);
    const updated = await this.prisma.userPreference.update({
      where: { userId },
      data: {
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.sendOnEnter !== undefined
          ? { sendOnEnter: dto.sendOnEnter }
          : {}),
        ...(dto.messagePreview !== undefined
          ? { messagePreview: dto.messagePreview }
          : {}),
        ...(dto.desktopNotifications !== undefined
          ? { desktopNotifications: dto.desktopNotifications }
          : {}),
        ...(dto.soundEnabled !== undefined
          ? { soundEnabled: dto.soundEnabled }
          : {}),
        ...(dto.animationLevel !== undefined
          ? { animationLevel: dto.animationLevel }
          : {}),
        ...(dto.autoDownloadPhotos !== undefined
          ? { autoDownloadPhotos: dto.autoDownloadPhotos }
          : {}),
        ...(dto.autoDownloadVideos !== undefined
          ? { autoDownloadVideos: dto.autoDownloadVideos }
          : {}),
        ...(dto.autoDownloadFiles !== undefined
          ? { autoDownloadFiles: dto.autoDownloadFiles }
          : {}),
        ...(dto.saveToGallery !== undefined
          ? { saveToGallery: dto.saveToGallery }
          : {}),
        ...(dto.fontSize !== undefined ? { fontSize: dto.fontSize } : {}),
        ...(dto.chatBackground !== undefined
          ? { chatBackground: dto.chatBackground }
          : {}),
      },
    });
    return this.mapPreferences(updated);
  }

  private mapPreferences(row: {
    theme: string;
    language: string;
    sendOnEnter: boolean;
    messagePreview: boolean;
    desktopNotifications: boolean;
    soundEnabled: boolean;
    animationLevel: string;
    autoDownloadPhotos: boolean;
    autoDownloadVideos: boolean;
    autoDownloadFiles: boolean;
    saveToGallery: boolean;
    fontSize: number;
    chatBackground: string | null;
    updatedAt: Date;
  }) {
    return {
      theme: row.theme,
      language: row.language,
      sendOnEnter: row.sendOnEnter,
      messagePreview: row.messagePreview,
      desktopNotifications: row.desktopNotifications,
      soundEnabled: row.soundEnabled,
      animationLevel: row.animationLevel,
      autoDownloadPhotos: row.autoDownloadPhotos,
      autoDownloadVideos: row.autoDownloadVideos,
      autoDownloadFiles: row.autoDownloadFiles,
      saveToGallery: row.saveToGallery,
      fontSize: row.fontSize,
      chatBackground: row.chatBackground,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
