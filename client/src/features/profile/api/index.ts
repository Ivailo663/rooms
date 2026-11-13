import { api } from "@/axios";
import type {
  Account,
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
