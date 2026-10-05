export interface CommunityStreamParticipant {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

export interface CommunityStreamState {
  isConnecting: boolean;
  channelId: string | null;
  channelTitle: string;
}
