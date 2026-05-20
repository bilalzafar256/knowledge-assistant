import type { Metadata } from "next";
import { DocumentUpload } from "@/components/document-upload";

export const metadata: Metadata = {
  title: "Upload Document",
};

export default function UploadPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          Upload Document
        </h1>
        <p className="text-muted-foreground mt-1">
          Add a document to your knowledge base. It will be automatically
          chunked and indexed for semantic search.
        </p>
      </div>

      <DocumentUpload />
    </div>
  );
}
