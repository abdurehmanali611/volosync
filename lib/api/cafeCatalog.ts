/** Cafe/staff account helpers used by shared profile components. */
import { toast } from "sonner";
import { api, API_URL } from "@/lib/api/client";

export async function changeOwnPassword(passwordData: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<boolean> {
  try {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return false;
    }
    await api.post(`${API_URL}/api/user/change_password/`, {
      old_password: passwordData.currentPassword,
      new_password: passwordData.newPassword,
    });
    toast.success("Password updated successfully");
    return true;
  } catch (error) {
    const message =
      (error as { response?: { data?: { errors?: { old_password?: string; new_password?: string } } } })
        ?.response?.data?.errors?.old_password ||
      (error as { response?: { data?: { errors?: { new_password?: string } } } })
        ?.response?.data?.errors?.new_password ||
      (error instanceof Error ? error.message : null) ||
      "Failed to update password";
    toast.error(message);
    return false;
  }
}
