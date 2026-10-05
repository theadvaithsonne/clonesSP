import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";

export interface ActivityPayload {
  type: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  description?: string;
  // Allow extra fields without breaking old callers
  [key: string]: unknown;
}

export async function createActivity(payload: ActivityPayload): Promise<void> {
  try {
    const body = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    const response = await authenticatedFetch(
      buildExternalUrl("crm/activities"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      // Swallow errors so activity logging never blocks main action
      // but log for debugging.
      console.error("Failed to create activity", await response.text());
    }
  } catch (error) {
    console.error("Error creating activity", error);
  }
}

