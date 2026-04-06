import React, { useState, useRef } from 'react';
import GlassCard from '../components/GlassCard';
import { faceEnrollment } from '../services/api';

const FaceEnrollment: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await faceEnrollment.enrollFace(file);
      setMessage({ type: 'success', text: `Face enrolled successfully for ${result.name}!` });
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to enroll face',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-neon-green mb-2">Face Enrollment</h1>
        <p className="text-text-secondary mb-8">Upload a clear photo of your face for attendance recognition</p>

        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                preview
                  ? 'border-neon-green/50 bg-neon-green/5'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              {preview ? (
                <div className="space-y-4">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-text-secondary hover:text-white text-sm"
                  >
                    Remove & choose another
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    className="w-16 h-16 mx-auto text-text-secondary mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-text-secondary mb-4">
                    Click to upload or drag and drop
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="face-upload"
                  />
                  <label
                    htmlFor="face-upload"
                    className="inline-block bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl cursor-pointer transition-colors"
                  >
                    Choose Image
                  </label>
                </>
              )}
            </div>

            {/* Guidelines */}
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="text-white font-medium mb-2">Photo Guidelines</h3>
              <ul className="text-text-secondary text-sm space-y-1">
                <li>• Use a clear, well-lit photo</li>
                <li>• Face should be directly facing the camera</li>
                <li>• Include only one face in the photo</li>
                <li>• No glasses, hats, or heavy accessories</li>
                <li>• Photo should be in JPG or PNG format</li>
              </ul>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`px-4 py-3 rounded-xl ${
                  message.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || loading}
              className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                file && !loading
                  ? 'bg-neon-green text-black hover:bg-neon-green/80'
                  : 'bg-white/10 text-text-secondary cursor-not-allowed'
              }`}
            >
              {loading ? 'Processing...' : 'Enroll Face'}
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
};

export default FaceEnrollment;