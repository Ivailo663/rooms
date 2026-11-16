import { api } from "@/axios";
import type {
  Account,
  CreateMediaRequest,
  MediaItem,
  PlayerProfile,
  UpdateProfileRequest,
} from "@football/shared";

export const getPlayer = async (id: number): Promise<PlayerProfile> => {
  const { data } = await api.get<PlayerProfile>(`/players/${id}`);

  return data;
};

export const getCities = async (): Promise<string[]> => {
  const { data } = await api.get<string[]>("/cities");

  return data;
};

export const updateProfile = async (
  update: UpdateProfileRequest
): Promise<Account> => {
  const { data } = await api.patch<Account>("/user", update);

  return data;
};

export const getPlayerMedia = async (id: number): Promise<MediaItem[]> => {
  const { data } = await api.get<MediaItem[]>(`/players/${id}/media`);

  return data;
};

export const createMedia = async (
  request: CreateMediaRequest
): Promise<MediaItem> => {
  const { data } = await api.post<MediaItem>("/media", request);

  return data;
};

export const deleteMedia = async (id: number): Promise<void> => {
  await api.delete(`/media/${id}`);
};
