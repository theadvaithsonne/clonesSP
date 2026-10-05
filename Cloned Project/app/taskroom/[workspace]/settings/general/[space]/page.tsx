"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Edit2, Loader2, Plus } from "lucide-react";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import Cookies from "js-cookie";
import { useRef } from "react";
import { toast } from "sonner";

export default function WorkspaceSettingsPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [customBranding, setCustomBranding] = useState(false);
  const [customUrl, setCustomUrl] = useState("app");
  const [selectedColor, setSelectedColor] = useState("#008080"); // Default matching the G avatar color somewhat

  const { currentWorkspace, updateWorkspace } = useWorkspaceStore();
  const [isUploadingRound, setIsUploadingRound] = useState(false);
  const [isUploadingRectangle, setIsUploadingRectangle] = useState(false);
  // const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0]
  //   if (!file) return

  //   setIsUploading(true)
  //   const formData = new FormData()
  //   formData.append("file", file)
  //   formData.append("folder", folderName)

  //   try {
  //     const uploadResponse = await fetch(
  //       "https://uatapi.garage.app/api/s3upload/single",
  //       { method: "POST", body: formData }
  //     )

  //     if (!uploadResponse.ok) throw new Error("Upload failed")

  //     const uploadResult = await uploadResponse.json()
  //     if (!uploadResult.success || !uploadResult.data)
  //       throw new Error("Invalid upload response")

  //     const fileType = getSimplifiedFileType(file.type)

  //     const payload = {
  //       roomId: taskRoomId,
  //       userId: currentUser,
  //       fileLink: uploadResult.data.url,
  //       fileName: uploadResult.data.fileName,
  //       fileType,
  //       comment: "Uploaded via FilesView",
  //     }

  //     const recordRes = await fetch("https://uatapi.garage.app/taskroom/v1/files", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(payload),
  //     })

  //     if (!recordRes.ok) throw new Error("Failed to record file")

  //     const recordData = await recordRes.json()

  //     const sizeStr =
  //       uploadResult.data.size && uploadResult.data.size > 0
  //         ? `${(uploadResult.data.size / 1024 / 1024).toFixed(2)} MB`
  //         : "Unknown"

  //     const newFile: FileItem = {
  //       id: recordData.data._id || Date.now().toString(),
  //       name: uploadResult.data.fileName,
  //       type: fileType,
  //       size: sizeStr,
  //       author: { name: currentUser, avatar: currentUser.slice(0, 2).toUpperCase() },
  //       date: new Date().toISOString().split("T")[0],
  //       fileLink: uploadResult.data.url,
  //     }

  //     if (page === 1) {
  //       setFiles((prev) => [newFile, ...prev])
  //     }

  //     toast.success(`"${newFile.name}" uploaded successfully!`)
  //   } catch (err) {
  //     console.error("Upload error:", err)
  //     toast.error("Failed to upload file. Please try again.")
  //   } finally {
  //     setIsUploading(false)
  //     if (fileInputRef.current) fileInputRef.current.value = ""
  //   }
  // }


  const uploadImage = async (file): Promise<string> => {
    console.log("czxczxc12312", file)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "Uploads");

    const res = await fetch(`https://uatapi.garage.app/api/s3upload/single`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`S3 upload failed: ${res.status} ${errorText}`);
    }

    const json = await res.json();
    if (!json.success || !json.data?.url) {
      throw new Error("Invalid S3 response format");
    }
    console.log("json.data", json.data)
    return json.data.url;
  };

  const handleLogoUpload = async (file, type: 'round' | 'rectangle') => {
    if (!currentWorkspace?._id) {
      toast.error("No workspace selected");
      return;
    }

    const setLoader = type === 'round' ? setIsUploadingRound : setIsUploadingRectangle;
    setLoader(true);

    try {
      const url = await uploadImage(file);
      const updateData = type === 'round'
        ? { image_circle_url: url }
        : { image_square_url: url };
      console.log("updateData", updateData)
      await updateWorkspace(currentWorkspace?._id, updateData);
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setLoader(false);
    }
  };

  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const handleNameUpdate = async () => {
    if (!currentWorkspace?._id || !workspaceName.trim()) {
      toast.error("Invalid workspace name");
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateWorkspace(currentWorkspace._id, { name: workspaceName.trim() });
      toast.success("Workspace name updated successfully");
    } catch (error: any) {
      console.error("Name update failed:", error);
      toast.error(error.message || "Failed to update workspace name");
    } finally {
      setIsUpdatingName(false);
    }
  };



  useEffect(() => {
    if (currentWorkspace?.name) {
      setWorkspaceName(currentWorkspace?.name)
      setSelectedColor(currentWorkspace?.color)
    }

  }, [currentWorkspace])

  const handleColorUpdate = async (color: string) => {
    if (!currentWorkspace?._id) {
      toast.error("No workspace selected");
      return;
    }

    try {
      setSelectedColor(color);
      await updateWorkspace(currentWorkspace._id, { color });
      toast.success("Workspace color updated successfully");
    } catch (error: any) {
      console.error("Color update failed:", error);
      toast.error(error.message || "Failed to update color");
      // Revert local state if API fails
      setSelectedColor(currentWorkspace.color);
    }
  };

  const colors = [
    "#3C3C3C", // Purple/Blue
    "#4B0082", // DarkOrchid
    "#000080", // BlueViolet
    "#8B008B", // Orchid
    "#483D8B", // Violet
    "#191970", // Plum
    "#CC5500", // Magenta
    "#008080", // MediumOrchid
    "#5C4033", // MediumPurple
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#111116] border border-[#e5e7eb29] border-l-0 rounded-tr-lg rounded-br-lg  w-full mx-auto p-6">
      <h1 className="text-[24px] font-bold mb-10 text-white tracking-tight">
        Workspace Settings
      </h1>
      {/* General Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-white">
          General
        </h2>
        <div className="border border-[#e5e7eb29] rounded-lg bg-[#111116] divide-y divide-[#e5e7eb29] shadow-sm">
          {/* Avatar Row */}
          {/* <div className="flex items-center justify-between p-3">
            <span className="text-xs font-medium text-white">
              Avatar
            </span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentWorkspace?.image_circle_url} />
              <AvatarFallback className="bg-indigo-600 text-white font-medium">
                {currentWorkspace?.name?.charAt(0).toUpperCase() || "G"}
              </AvatarFallback>
            </Avatar>
          </div> */}

          {/* Name Row */}
          <div className="flex items-center justify-between p-3">
            <span className="text-xs font-medium text-white">
              Name
            </span>
            <div className="w-full max-w-sm flex items-center gap-2">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameUpdate();
                }}
                className="
    h-8 text-xs px-3 py-1 placeholder:text-xs
    bg-[#111116] text-white
    border border-[#e5e7eb29]
    shadow-none
    focus:border-[#e5e7eb29]
    focus:outline-none focus-visible:outline-none
    focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0
  "
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs cursor-pointer font-medium bg-[#343439] text-white hover:bg-[#343439] border-none disabled:bg-gray-500 disabled:text-gray-100"
                onClick={handleNameUpdate}
                disabled={isUpdatingName || !workspaceName.trim() || workspaceName.trim() === currentWorkspace?.name}
              >
                {isUpdatingName ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Branding Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-white">
            Custom branding
          </h2>
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-sm px-1.5 py-0.5 text-xs font-normal"
          >
            Enterprise
          </Badge>
        </div>

        <div className="border border-[#e5e7eb29] rounded-lg bg-[#111116] divide-y divide-[#e5e7eb29] shadow-sm">
          {/* Enable Switch */}
          

          {/* Round Logo */}
          <div className="flex items-center justify-between p-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-white">
                Round logo
              </div>
              <div className="text-xs text-gray-400">
                We recommend a 72 x 72 px PNG file. This logo is used in-app as
                your Workspace avatar.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="round-logo-input" className="cursor-pointer group flex items-center gap-4">
                <input
                  id="round-logo-input"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file, 'round');
                  }}
                  disabled={isUploadingRound || isUploadingRectangle}
                />

                {/* Visual Circle Placeholder/Preview */}
                <div className="h-12 w-12 rounded-full border-2 border-dashed border-[#e5e7eb29] flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-colors bg-[#111116]">
                  {currentWorkspace?.image_circle_url ? (
                    <img src={currentWorkspace.image_circle_url} alt="Round logo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <Plus className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
                    </div>
                  )}
                </div>

                {/* Styled Label that looks like a button */}
                <div className={`h-8 px-3 rounded text-xs font-medium border flex items-center justify-center transition-colors
                  ${(isUploadingRound || isUploadingRectangle) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#111116] text-white border-[#e5e7eb29] hover:bg-[#343439]'}`}>
                  {isUploadingRound ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    currentWorkspace?.image_circle_url ? 'Change' : 'Add'
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Rectangle Logo */}
          <div className="flex items-center justify-between p-3">
            <div className="space-y-1 max-w-2xl">
              <div className="text-xs font-medium text-white">
                Rectangle logo
              </div>
              <div className="text-xs text-gray-400">
                We recommend a 232 x 48 px PNG file.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="rect-logo-input" className="cursor-pointer group flex items-center gap-4">
                <input
                  id="rect-logo-input"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file, 'rectangle');
                    e.target.value = '';
                  }}
                  disabled={isUploadingRectangle || isUploadingRound}
                />

                {/* Visual Rectangle Placeholder/Preview */}
                <div className="h-10 w-24 rounded border-2 border-dashed border-[#e5e7eb29] flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-colors bg-[#111116]">
                  {currentWorkspace?.image_square_url ? (
                    <img src={currentWorkspace.image_square_url} alt="Rectangle logo" className="h-full w-full object-contain" />
                  ) : (
                    <Plus className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
                  )}
                </div>

                {/* Styled Label that looks like a button */}
                <div className={`h-8 px-3 rounded text-xs font-medium border flex items-center justify-center transition-colors
                  ${(isUploadingRectangle || isUploadingRound) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#111116] text-white border-[#e5e7eb29] hover:bg-[#343439]'}`}>
                  {isUploadingRectangle ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    currentWorkspace?.image_square_url ? 'Change' : 'Add'
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Social Media Graphic */}
          {/* <div className="flex items-center justify-between p-3">
            <div className="space-y-1 max-w-2xl">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Social media graphic
              </div>
              <div className="text-xs text-muted-foreground">
                We recommend a 500 x 260 px PNG file. This graphic serves as the
                preview image when ClickUp links are shared.
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700">
              Add
            </Button>
          </div> */}

          {/* Color Scheme */}
          <div className="flex items-center justify-between p-3">
            <span className="text-xs font-medium text-white">
              Color scheme
            </span>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorUpdate(color)}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950 focus:ring-indigo-500 ${selectedColor === color ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ring-gray-400" : ""
                      }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              {/* <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2 text-gray-400 hover:text-gray-600"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button> */}
            </div>
          </div>

          {/* Custom URL */}
          
        </div>
      </section>

      {/* Danger Zone Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-white">
          Danger zone
        </h2>
        <div className="border border-red-900/30 rounded-lg bg-[#111116] shadow-sm">
          <div className="flex items-center justify-between p-3">
            <span className="text-xs font-medium text-white">
              Delete this Workspace forever
            </span>
            <Button
              variant="outline"
              className="text-red-600 text-[12px] border-red-200 bg-white hover:bg-red-50 hover:border-red-300 dark:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Delete Workspace
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
