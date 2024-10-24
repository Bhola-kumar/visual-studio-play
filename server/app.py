from flask import Flask, send_file, jsonify, request
import os
import re
import uuid
import yt_dlp
import subprocess
from flask_cors import CORS

# DOWNLOAD_DIR = 'C:/Users/bhola/Desktop/videoHost/downloads'
# OUTPUT_DIR = 'C:/Users/bhola/Desktop/videoHost/converted_videos'
DOWNLOAD_DIR = None
OUTPUT_DIR = None
app = Flask(__name__)
CORS(app)

def convert_video(video_path, output_path):
    try:
        ffmpeg_path = 'C:/ffmpeg/bin/ffmpeg.exe'  # Replace with the actual path to ffmpeg

        # Example command using FFmpeg
        command = f'{ffmpeg_path} -i "{video_path}" -c:v copy -c:a libvorbis "{output_path}" -vn'
        
        # Run the command
        result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Check if the command was successful
        if result.returncode != 0:
            error_message = result.stderr.decode('utf-8')
            return False, f"Error converting video yaha: {error_message}"
        
        return True, f"Video successfully converted to: {output_path}"
    except Exception as e:
        return False, f"Error converting video: {str(e)}"
    
def convert_video_and_delete_original(video_path, output_path):
    success, message = convert_video(video_path, output_path)
    if success:
        try:
            os.remove(video_path)  # Delete the original file
        except Exception as e:
            return False, f"Error deleting original video: {str(e)}"
    return success, message


@app.route('/list_videos', methods=['GET'])
def list_videos():
    path = request.args.get('path', '')
    full_path = os.path.join(OUTPUT_DIR, path)
    
    if not os.path.exists(full_path):
        return jsonify({"error": "Directory does not exist"}), 404
    
    try:
        items = []
        for entry in os.scandir(full_path):
            items.append({
                'name': entry.name,
                'is_dir': entry.is_dir()
            })
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/browse_videos', methods=['GET'])
def browse_videos():
    path = request.args.get('path', '')
    full_path = os.path.join(DOWNLOAD_DIR, path)
    
    if not os.path.exists(full_path):
        return jsonify({"error": "Directory does not exist"}), 404
    
    try:
        items = []
        for entry in os.scandir(full_path):
            items.append({
                'name': entry.name,
                'is_dir': entry.is_dir()
            })
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/set_paths', methods=['POST'])
def set_paths():
    global DOWNLOAD_DIR, OUTPUT_DIR

    folder_path = request.form.get('folder_path')
    if not folder_path:
        return jsonify({"error": "No folder path provided"}), 400

    # Check for 'downloads' directory
    downloads_path = os.path.join(folder_path, 'downloads')
    if not os.path.exists(downloads_path):
        os.makedirs(downloads_path)
    DOWNLOAD_DIR = downloads_path

    # Check for 'converted_videos' directory
    converted_videos_path = os.path.join(folder_path, 'converted_videos')
    if not os.path.exists(converted_videos_path):
        os.makedirs(converted_videos_path)
    OUTPUT_DIR = converted_videos_path

    return jsonify({
        "message": "Paths set successfully"
    })
@app.route('/get_paths', methods=['GET'])
def get_paths():
    global DOWNLOAD_DIR, OUTPUT_DIR
    return jsonify({
        "DOWNLOAD_DIR": DOWNLOAD_DIR,
        "OUTPUT_DIR": OUTPUT_DIR
    })
@app.route('/serve/<path:filename>')
def serve_video(filename):
    video_path = os.path.join(OUTPUT_DIR, filename)

    # Security check
    if not video_path.startswith(OUTPUT_DIR):
        return "Invalid file path", 403

    # Check if file exists
    if not os.path.isfile(video_path):
        return "File not found", 404
    
    return send_file(video_path)

@app.route('/convert/<path:filename>', methods=['POST'])
def convert_video_request(filename):
    video_path = os.path.join(DOWNLOAD_DIR, filename)

    # Security check
    if not video_path.startswith(DOWNLOAD_DIR):
        return "Invalid file path", 403

    if os.path.isfile(video_path):
        sanitized_filename = sanitize_filename(os.path.basename(filename))
        output_path = os.path.join(OUTPUT_DIR, sanitized_filename)
        success, conversion_message = convert_video(video_path, output_path)
        if success:
            return jsonify({"message": conversion_message, "filename": sanitized_filename})
        else:
            return jsonify({"error": conversion_message}), 500

    elif os.path.isdir(video_path):
        converted_dir = os.path.join(OUTPUT_DIR, os.path.basename(filename))
        os.makedirs(converted_dir, exist_ok=True)

        conversion_results = []
        for root, _, files in os.walk(video_path):
            for file in files:
                input_file_path = os.path.join(root, file)
                relative_path = os.path.relpath(root, DOWNLOAD_DIR)
                output_file_dir = os.path.join(OUTPUT_DIR, relative_path)
                os.makedirs(output_file_dir, exist_ok=True)
                sanitized_filename = sanitize_filename(file)
                output_file_path = os.path.join(output_file_dir, sanitized_filename)
                success, conversion_message = convert_video(input_file_path, output_file_path)
                conversion_results.append({
                    "file": sanitized_filename,
                    "message": conversion_message,
                    "success": success
                })

        return jsonify({"results": conversion_results})

    return "File or directory not found", 404

@app.route('/download', methods=['POST'])
def download_video():
    data = request.json
    video_url = data.get('url')

    if not video_url:
        return jsonify({"error": "URL is required"}), 400

    try:
        with yt_dlp.YoutubeDL() as ydl:
            info_dict = ydl.extract_info(video_url, download=False)

        # Configure yt_dlp options
        if 'entries' in info_dict:
            # It's a playlist
            playlist_title = info_dict.get('title', 'playlist')
            download_path = os.path.join(DOWNLOAD_DIR, playlist_title, '%(title)s.%(ext)s')
            ydl_opts = {
                'format': 'best',
                'outtmpl': download_path,
                'noplaylist': False  # Ensure playlists are downloaded
            }
        else:
            # It's a single video
            download_path = os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s')
            ydl_opts = {
                'format': 'best',
                'outtmpl': download_path,
                'noplaylist': True  # Ensure only a single video is downloaded
            }

        # Download the video or playlist
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=True)

            if 'entries' in info_dict:
                # Playlist case: Collect filenames of all videos
                filenames = []
                for entry in info_dict['entries']:
                    file_path = ydl.prepare_filename(entry)
                    filenames.append(os.path.basename(file_path))
                return jsonify({"filenames": filenames})
            else:
                # Single video case: Return the filename
                file_path = ydl.prepare_filename(info_dict)
                filename = os.path.basename(file_path)
                return jsonify({"filename": filename})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download_and_convert', methods=['POST'])
def download_and_convert():
    data = request.json
    video_url = data.get('url')

    if not video_url:
        return jsonify({"error": "URL is required"}), 400

    try:
        with yt_dlp.YoutubeDL() as ydl:
            info_dict = ydl.extract_info(video_url, download=False)

        # Configure yt_dlp options
        if 'entries' in info_dict:
            # It's a playlist
            playlist_title = info_dict.get('title', 'playlist')
            download_path = os.path.join(DOWNLOAD_DIR, playlist_title, '%(title)s.%(ext)s')
            ydl_opts = {
                'format': 'best',
                'outtmpl': download_path,
                'noplaylist': False  # Ensure playlists are downloaded
            }
        else:
            # It's a single video
            download_path = os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s')
            ydl_opts = {
                'format': 'best',
                'outtmpl': download_path,
                'noplaylist': True  # Ensure only a single video is downloaded
            }

        # Download the video or playlist
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=True)

            conversion_results = []

            if 'entries' in info_dict:
                # Playlist case: Convert all videos in the playlist
                for entry in info_dict['entries']:
                    file_path = ydl.prepare_filename(entry)
                    filename = os.path.basename(file_path)
                    sanitized_filename = sanitize_filename(filename)
                    output_file_dir = os.path.join(OUTPUT_DIR, playlist_title)
                    os.makedirs(output_file_dir, exist_ok=True)
                    output_path = os.path.join(output_file_dir, sanitized_filename)
                    success, conversion_message = convert_video_and_delete_original(file_path, output_path)
                    conversion_results.append({
                        "file": sanitized_filename,
                        "message": conversion_message,
                        "success": success
                    })

                # Delete the empty folder
                try:
                    os.rmdir(os.path.join(DOWNLOAD_DIR, playlist_title))
                except OSError as e:
                    # The directory is not empty or there was another error
                    pass
                return jsonify({"results": conversion_results})
            else:
                # Single video case: Convert the video
                file_path = ydl.prepare_filename(info_dict)
                filename = os.path.basename(file_path)
                sanitized_filename = sanitize_filename(filename)
                output_path = os.path.join(OUTPUT_DIR, sanitized_filename)
                success, conversion_message = convert_video_and_delete_original(file_path, output_path)
                if success:
                    return jsonify({"message": conversion_message, "filename": sanitized_filename})
                else:
                    return jsonify({"error": conversion_message}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def sanitize_filename(filename):
    """
    Sanitizes the filename by removing or replacing unconventional characters.
    Ensures the filename is valid and unique.
    """
    # Remove invalid characters
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)

    # Add a unique identifier to the filename to ensure uniqueness
    unique_id = uuid.uuid4().hex
    name, ext = os.path.splitext(sanitized)
    sanitized_filename = f"{name}_{unique_id}{ext}"

    return sanitized_filename

if __name__ == '__main__':
    app.run(debug=True, port=5000)
