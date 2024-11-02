import React, { useState, useEffect } from 'react';
import './App.css'; // Include CSS for overlay

function App() {
  const [inputText, setInputText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [manualTaskId, setManualTaskId] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // For image upload
  const [caption, setCaption] = useState(''); // For generated caption
  const [captionTaskId, setCaptionTaskId] = useState(null); // Task ID for caption generation
  const [imageSrc, setImageSrc] = useState(null); // For displaying the uploaded image

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setImageUrl(null); // Clear previous image

    // Make an API request to send the text input to the server
    const response = await fetch('/api/v1/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 'text': inputText }),
    });
    const data = await response.json();

    // The server returns a task ID for polling
    setTaskId(data.task_id);
    setManualTaskId(data.task_id); // Set the task ID for manual fetch
  };

  const handleManualFetch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setImageUrl(null);

    try {
      const response = await fetch(`/api/v1/generate-image/${manualTaskId}`);
      const data = await response.json();

      if (data.data.image !== undefined) {
        setImageUrl(data.data.image);
      } else {
        console.error('Image not found for the given task ID');
        // You might want to add some user feedback here
        // if task id is not found, we need to show the user that the task id is not found
        alert('Task ID not found');
      }
    } catch (error) {
      console.error('Error fetching image:', error);
      // You might want to add some user feedback here
    }

    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result); // Set the image source to the file data
      };
      reader.readAsDataURL(file); // Read the file as a data URL
    }

    setSelectedImage(file);
    setCaption(''); // Clear previous caption
  };

  const handleCaptionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage) return;

    setLoading(true);
    setCaption(''); // Clear previous caption

    // Prepare form data to send the image to the server
    const formData = new FormData();
    formData.append('image', selectedImage);

    // Make an API request to upload the image and generate a caption
    const response = await fetch('/api/v1/generate-description', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    // The server returns a task ID for polling
    setCaptionTaskId(data.task_id);
  };

  // Poll the server continuously until the caption is ready
  useEffect(() => {
    if (!captionTaskId) {
      console.log('No caption task id set yet');
      return;
    }

    const interval = setInterval(async () => {
      console.log(`Polling caption for task ID ${captionTaskId}`);
      const response = await fetch(`/api/v1/generate-description/${captionTaskId}`);
      const data = await response.json();

      if (data.data && data.data.caption !== undefined && data.data.caption !== "") {
        setCaption(data.data.caption);
        setLoading(false);
        clearInterval(interval); // Stop polling when the caption is ready
        console.log(`Caption ready: ${data.data.caption}`);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [captionTaskId]);

  // Poll the server continuously until the image is ready
  useEffect(() => {
    if (!taskId) {
      console.log('No task id set yet');
      return;
    }

    const interval = setInterval(async () => {
      console.log(`Polling ${taskId}`);
      const response = await fetch(`/api/v1/generate-image/${taskId}`);
      const data = await response.json();

      if (data.data.image !== undefined) {
        setImageUrl(data.data.image);
        setLoading(false);
        clearInterval(interval); // Stop polling when the image is ready
        console.log(`Image ready ${data.data.image}`);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [taskId]);

  return (
    <div className="App">
      {loading && (
        <div className="overlay">
          <div className="spinner"></div>
          <p>Processing... Please wait.</p>
        </div>
      )}
      <div class="container">
      <div>
      <h1>Text to Image Generator</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter text to generate image"
          required
          disabled={loading} // Disable input when loading
          rows={3}
          cols={60}
          className="large-input"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Image'}
        </button>
      </form>

      <h2>Fetch Image by Task ID</h2>
      <form onSubmit={handleManualFetch}>
        <input
          className="manual-taskid-input" 
          type="text"
          value={manualTaskId}
          onChange={(e) => setManualTaskId(e.target.value)}
          placeholder="Enter task ID"
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Fetch Image
        </button>
      </form>
      

      {imageUrl && <img src={imageUrl} alt="Generated" />}
      </div>
      
      <div>
      <h1>Image Caption Generator</h1>
      <form onSubmit={handleCaptionSubmit}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          required
          disabled={loading} // Disable input when loading
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating Caption...' : 'Generate Caption'}
        </button>
      </form>
      {imageSrc && (
        <div>
          <h4>Image Preview:</h4>
          <img src={imageSrc} alt="Selected" style={{ maxWidth: "100%", maxHeight: "300px" }} />
        </div>
      )}

      {caption && (
        <div>
          <h2>Generated Caption:</h2>
          <p>{caption}</p>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

export default App;
