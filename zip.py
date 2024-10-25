import zipfile

def unzip_file(zip_file_path, extract_path):
    try:
        with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        print(f"Files extracted successfully from {zip_file_path} to {extract_path}")
    except zipfile.BadZipFile:
        print(f"Error: {zip_file_path} is not a valid .zip file.")
    except Exception as e:
        print(f"An error occurred: {e}")

# Example usage:
zip_file_path = './ffmpeg/ffmpeg.zip'
extract_path = './ram'
unzip_file(zip_file_path, extract_path)