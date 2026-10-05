"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Folder, Home, ChevronRight } from "lucide-react";
import { ContextAppApi } from "@/ContextAppApi";
import { toast } from "sonner";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import { useUser } from "@/context/UserContext";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { Document, SubFolder, DocumentListResponse } from "@/types/documents";

interface ProgramData {
  _id: string;
  companyName: string;
  type: string;
  idea: string;
  createdAt: string;
  completedPercentage: number;
  programtypeid: string;
  stage?: Array<{
    name: string;
    completionStatus: string;
    // Add other stage properties as needed
  }>;
}



// Main Component
const DocumentManager: React.FC = () => {
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<ProgramData | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const context = useContext(ContextAppApi);
  const { organizationId } = useUser();

  // Get sub-folders from the selected program's stages
  const getSubFolders = (program: ProgramData): SubFolder[] => {
    if (!program.stage || !Array.isArray(program.stage)) {
      return [];
    }

    return program.stage.map(stage => ({
      name: stage.name,
      icon: "/appicons/folder.svg"
    }));
  };

  useEffect(() => {
    const fetchPrograms = async () => {
      if (!context?.storeUser?.email) return;

      try {
        setLoading(true);
        const response = await fetch(
          `https://startupbrokers.marketsverse.com/api/getprogramtypeclone?email=${encodeURIComponent(context.storeUser.email)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data?.status) {
          setPrograms(data?.data || []);
        } else {
          setPrograms([]);
        }
      } catch (error) {
        console.error("Error fetching programs:", error);
        toast.error("Failed to fetch programs");
        setPrograms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, [context?.storeUser?.email]);

  const handleProgramClick = (program: ProgramData) => {
    setSelectedProgram(program);
    setSelectedSubfolder(null);
  };

  const handleSubfolderClick = (subfolderName: string) => {
    setSelectedSubfolder(subfolderName);
    fetchDocuments(selectedProgram?._id || '', subfolderName);
  };

  const handleBackToPrograms = () => {
    setSelectedProgram(null);
    setSelectedSubfolder(null);
  };

  const handleBackToSubfolders = () => {
    setSelectedSubfolder(null);
    setDocuments([]);
  };

  // Fetch documents for a specific program and subfolder
  const fetchDocuments = async (programId: string, subfolder: string) => {
    if (!organizationId || !programId || !subfolder) return;

    try {
      setDocumentsLoading(true);
      const queryParams = new URLSearchParams({
        programId,
        subfolder,
        organizationId,
      });

      const response = await authenticatedFetch(
        buildExternalUrl(`program-documents?${queryParams.toString()}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DocumentListResponse = await response.json();
      if (data?.status) {
        setDocuments(data?.data || []);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleUploadComplete = () => {
    if (selectedProgram && selectedSubfolder) {
      fetchDocuments(selectedProgram._id, selectedSubfolder);
    }
  };

  if (!context) {
    return (
      <div className="text-center text-red-500 p-6">
        Error: ContextAppApi not found. Ensure component is wrapped in ContextAppApiProvider.
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0e0e12] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <nav className="flex items-center space-x-2 mt-2">
            <button
              onClick={handleBackToPrograms}
              className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4 mr-1" />
              Home
            </button>
            {selectedProgram && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={handleBackToSubfolders}
                  className={`text-sm transition-colors ${selectedSubfolder
                      ? "text-gray-400 hover:text-white"
                      : "text-white font-medium cursor-default"
                    }`}
                  disabled={!selectedSubfolder}
                >
                  {selectedProgram.companyName}
                </button>
              </>
            )}
            {selectedSubfolder && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white font-medium">
                  {selectedSubfolder}
                </span>
              </>
            )}
          </nav>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-white text-black hover:bg-gray-200 rounded-3xl h-10 px-5 font-semibold"
          disabled={!selectedSubfolder}
        >
          Add Documents
        </Button>
      </div>

      {/* Content Area */}
      {/* {selectedProgram && (
        <div className="mt-6">
          <Button
            onClick={handleBackToPrograms}
            variant="outline"
            className="px-6 py-2"
          >
            ← Back to Programs
          </Button>
        </div>
      )} */}
      <div className="bg-[#1e1e2d] rounded-lg p-6 min-h-96 border border-[#e5e7eb29]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : selectedProgram ? (
          selectedSubfolder ? (
            // Documents view inside subfolder
            documentsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <DocumentList
                documents={documents}
                onRefresh={() => fetchDocuments(selectedProgram._id, selectedSubfolder)}
              />
            )
          ) : (
            // Sub-folders view
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {getSubFolders(selectedProgram).map((folder, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center hover:bg-[#0e0e12] rounded-lg transition-colors group cursor-pointer p-4 border border-transparent hover:border-[#e5e7eb29]"
                  onClick={() => handleSubfolderClick(folder.name)}
                >
                  <div className="w-20 h-16 mb-4 flex items-center justify-center">
                    <Folder className="w-full h-full text-red-500" />
                  </div>
                  <span className="text-sm text-center text-gray-300 font-medium group-hover:text-white break-words">
                    {folder.name}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : programs.length > 0 ? (
          // Programs view
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {programs.map((program, index) => (
              <div
                key={program._id || index}
                className="flex flex-col items-center hover:bg-[#0e0e12] rounded-lg transition-colors group cursor-pointer p-4 border border-transparent hover:border-[#e5e7eb29]"
                onClick={() => handleProgramClick(program)}
              >
                <div className="w-20 h-16 mb-4 flex items-center justify-center">
                  <Folder className="w-full h-full text-purple-600" />
                </div>
                <span className="text-sm text-center text-gray-300 font-medium group-hover:text-white break-words">
                  {program.companyName}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500 text-lg">No programs found</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && selectedProgram && selectedSubfolder && (
        <DocumentUpload
          programId={selectedProgram._id}
          subfolder={selectedSubfolder}
          onUploadComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
};

export default DocumentManager;
