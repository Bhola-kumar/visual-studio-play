let currentdownloadandconvertTask = null;
let currentconvertTask = null;
let currentdownloadTask = null;
let currentplayTask = null;
let currentPath = "";
let selectedExplorerFile = "";
let browsePath = "";
let selectedBrowseFile = "";
let videoListArray = [];
let currentVideoIndex = -1;
let mapstoreIndex = new Map();
let countdownInterval;

document.addEventListener("DOMContentLoaded", () => {
  fetchAvailableVideos();
  initializeDownloader();
  initializeDownloadAndConvert();
  initializeConvertor();
  initializeVideoExplorer();
  initializeBrowseFeature();
});

function initializeVideoExplorer() {
  document
    .getElementById("exploreList")
    .addEventListener("click", async (e) => {
      if (e.target && e.target.nodeName === "LI") {
        const isDir = e.target.getAttribute("data-is-dir") === "true";
        const name = e.target.getAttribute("data-name");

        if (isDir) {
          currentPath = currentPath ? `${currentPath}/${name}` : name;
          fetchAvailableVideos();
        } else {
          const filename = currentPath ? `${currentPath}/${name}` : name;
          // console.log(currentVideoIndex);
          currentVideoIndex = videoListArray.findIndex(
            (video) => video.name === name
          );
          focusCurrentItemVideoExplorer(currentVideoIndex);
          mapstoreIndex.set(currentPath, currentVideoIndex);
          // console.log(mapstoreIndex);
          // console.log(filename);
          // console.log(currentVideoIndex);
          playVideo(filename);
        }
      }
    });

  document.getElementById("breadcrumb").addEventListener("click", (e) => {
    if (
      e.target &&
      e.target.nodeName === "SPAN" &&
      !e.target.classList.contains("current-dir")
    ) {
      const path = e.target.getAttribute("data-path");
      currentPath = path;
      if (currentPath[0] === "/") {
        currentPath = currentPath.slice(1);
      }
      fetchAvailableVideos();
    }
  });
  document.getElementById("breadcrumb-bar").addEventListener("click", (e) => {
    const name = e.target.getAttribute("data-name");
    if (name === "..") {
      // Go back to the parent directory
      const pathParts = currentPath.split("/");
      pathParts.pop();
      currentPath = pathParts.join("/");
      selectedExplorerFile = "";
      fetchAvailableVideos();
    }
  });
  document
    .getElementById("nextButton")
    .addEventListener("click", playNextVideo);
  document
    .getElementById("prevButton")
    .addEventListener("click", playPreviousVideo);
}

function initializeDownloadAndConvert() {
  document
    .getElementById("downloadAndconvertButton")
    .addEventListener("click", async () => {
      const youtubeUrl = document.getElementById("youtubeUrl").value;
      const dandcstatusDiv = document.getElementById("dandcstatus");

      if (!youtubeUrl) {
        dandcstatusDiv.textContent = "Please enter a valid YouTube URL.";
        return;
      }

      try {
        if (currentdownloadandconvertTask) {
          // Cancel the current task
          dandcstatusDiv.textContent = "Cancelling previous task...";
          currentdownloadandconvertTask.cancel();
          currentdownloadandconvertTask = null;
        }

        currentdownloadandconvertTask = createdownloadandconvertTask(
          youtubeUrl,
          dandcstatusDiv
        );
        await currentdownloadandconvertTask.run();
        currentdownloadandconvertTask = null;
      } catch (error) {
        dandcstatusDiv.textContent = `Request failed: ${error.message}`;
      }
    });
}

function createdownloadandconvertTask(youtubeUrl, dandcstatusDiv) {
  let isCancelled = false;

  return {
    cancel() {
      isCancelled = true;
    },
    async run() {
      if (isYouTubeUrl(youtubeUrl)) {
        await handleYouTubeUrl(youtubeUrl, dandcstatusDiv);
      } else {
        dandcstatusDiv.textContent = "Please enter a valid YouTube URL.";
      }
    },
  };

  async function handleYouTubeUrl(youtubeUrl, dandcstatusDiv) {
    dandcstatusDiv.textContent = "Downloading and converting...";

    const response = await fetch("http://127.0.0.1:5000/download_and_convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: youtubeUrl }),
    });

    if (isCancelled) {
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Download and convert failed");
    }

    const data = await response.json();
    const filename = data.filename;

    if (isCancelled) {
      return;
    }
    dandcstatusDiv.textContent = "Item added to explorer.";
    fetchAvailableVideos();
  }
}
function isvalidAudioVideoFIlename(filename) {
  const audioVideoFileExtensions = [
    "mp3",
    "mp4",
    "mkv",
    "avi",
    "mov",
    "flv",
    "wmv",
    "webm",
    "m4a",
    "3gp",
    "aac",
    "flac",
    "ogg",
    "wav",
  ];
  const fileExtension = filename.split(".").pop();
  return audioVideoFileExtensions.includes(fileExtension);
}
function createPlayTask(filename, videoSource, videoPlayer, vstatusDiv) {
  let isCancelled = false;

  return {
    cancel() {
      isCancelled = true;
    },
    async run() {
      if (isvalidAudioVideoFIlename(filename)) {
        videoSource.src = `http://127.0.0.1:5000/serve/${filename}`;
        videoPlayer.load();

        videoPlayer.oncanplay = () => {
          if (!isCancelled) {
            videoBlock();
            clearCountdown();
            videoPlayer.play();
          }
        };
        videoPlayer.onplaying = () => {
          if (!isCancelled) {
            const videoName = filename.split("/").pop();
            vstatusDiv.textContent = `Playing: ${videoName}`;
          }
        };
        videoPlayer.onended = () => {
          if (!isCancelled) {
            vstatusDiv.textContent = "Video completed";
            startCountdown(vstatusDiv, 3, playNextVideo);
          } else {
            vstatusDiv.textContent = "dhatt teri ma ki Video completed";
          }
        };

        videoPlayer.onerror = () => {
          if (!isCancelled) {
            vstatusDiv.textContent = "Error playing video";
          }
        };
      } else {
        const storeText = vstatusDiv.textContent;
        vstatusDiv.textContent = "Not a Audio/Video file";
        setTimeout(() => {
          vstatusDiv.textContent = storeText;
        }, 1000);
      }
    },
  };
}

function startCountdown(vstatusDiv, seconds, callback) {
  let remainingTime = seconds;
  vstatusDiv.textContent = `Next video starts in ${remainingTime} seconds...`;

  countdownInterval = setInterval(() => {
    remainingTime -= 1;
    if (remainingTime > 0) {
      vstatusDiv.textContent = `Next video starts in ${remainingTime} seconds...`;
    } else {
      clearInterval(countdownInterval);
      callback();
    }
  }, 1000);
}
function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
function focusCurrentItemVideoExplorer(currentVideoIndex) {
  const currentVideo = videoListArray[currentVideoIndex];
  const highlightItem = currentVideo.name;
  const videoItems = document.querySelectorAll("#videoList-ul li");
  videoItems.forEach((item) => item.classList.remove("clicked-item"));
  videoItems.forEach((item) => {
    if (item.getAttribute("data-name") === highlightItem) {
      item.classList.add("clicked-item");
    }
  });
}
function fetchAvailableVideos() {
  // console.log(`Fetching available videos from ...${currentPath}`);
  fetch(`http://127.0.0.1:5000/list_videos?path=${currentPath}`)
    .then((response) => response.json())
    .then((items) => {
      videoListArray = items.filter((item) => !item.is_dir);
      currentVideoIndex = mapstoreIndex.get(currentPath) || -1;

      const folders = items.filter((item) => item.is_dir);
      const videos = videoListArray;
      const emptySection = document.getElementById("emptySection");
      const folderSection = document.getElementById("folderSection");
      const folderListul = document.getElementById("folderList-ul");
      const videoSection = document.getElementById("videoSection");
      const videoListul = document.getElementById("videoList-ul");
      const videoSource = document.getElementById("videoSource").src;
      const currentplayingItem = videoSource.split("/").pop();
      emptySection.style.display = "none";
      folderListul.innerHTML = "";
      videoListul.innerHTML = "";
      const backItemDiv = document.getElementById("back-item-explorer");
      if (currentPath) {
        backItemDiv.style.display = "block";
      } else {
        backItemDiv.style.display = "none";
      }

      if (folders.length > 0) {
        folderSection.style.display = "block";
        folders.forEach((folder) => {
          const li = document.createElement("li");
          li.textContent = folder.name;
          li.setAttribute("data-name", folder.name);
          li.setAttribute("data-is-dir", folder.is_dir);
          folderListul.appendChild(li);
        });
      } else {
        folderSection.style.display = "none";
        // folderSection.style.display = "block";
      }

      if (videos.length > 0) {
        videoSection.style.display = "block";
        videos.forEach((video) => {
          const li = document.createElement("li");
          li.textContent = video.name;
          li.setAttribute("data-name", video.name);
          li.setAttribute("data-path", currentPath);
          li.setAttribute("data-is-dir", video.is_dir);
          if (currentplayingItem === video.name) {
            li.classList.add("clicked-item");
          }
          videoListul.appendChild(li);
        });
      } else {
        videoSection.style.display = "none";
      }
      updateBreadcrumb();
      adjustBarHeight();
    })
    .catch((error) => {
      console.error("Error fetching available videos:", error);
    });
}

function updateBreadcrumb() {
  const breadcrumb = document.getElementById("breadcrumb");
  breadcrumb.innerHTML = "";

  const pathSegments = currentPath.split("/").filter((segment) => segment);
  pathSegments.unshift("");

  pathSegments.forEach((segment, index) => {
    const span = document.createElement("span");
    const path = pathSegments.slice(0, index + 1).join("/");

    span.textContent = segment || "Home";
    span.setAttribute("data-path", path);

    if (index === pathSegments.length - 1) {
      span.classList.add("current-dir");
    } else {
      span.textContent += " / ";
    }

    breadcrumb.appendChild(span);
  });
}

function isYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return youtubeRegex.test(url);
}

async function playVideo(filename) {
  const videoSource = document.getElementById("videoSource");
  const videoPlayer = document.getElementById("videoPlayer");
  const vstatusDiv = document.getElementById("vstatus");

  if (currentplayTask) {
    vstatusDiv.textContent = "Cancelling previous video...";
    currentplayTask.cancel();
    currentplayTask = null;
    videoPlayer.pause();
    videoPlayer.src = "";
  }

  currentplayTask = createPlayTask(
    filename,
    videoSource,
    videoPlayer,
    vstatusDiv
  );
  await currentplayTask.run();
  currentplayTask = null;
}

function playNextVideo() {
  const vstatusDiv = document.getElementById("vstatus");
  if (currentVideoIndex < videoListArray.length - 1) {
    currentVideoIndex++;
    const nextVideo = videoListArray[currentVideoIndex];
    const filename = currentPath
      ? `${currentPath}/${nextVideo.name}`
      : nextVideo.name;
    mapstoreIndex.set(currentPath, currentVideoIndex);
    focusCurrentItemVideoExplorer(currentVideoIndex);

    playVideo(filename);
  } else {
    const storeText = vstatusDiv.textContent;
    if (currentVideoIndex === videoListArray.length) {
      vstatusDiv.textContent = "No next video available.";
    } else {
      vstatusDiv.textContent = "No next video available.";
      setTimeout(() => {
        vstatusDiv.textContent = storeText;
      }, 500);
    }
  }
}

function playPreviousVideo() {
  const vstatusDiv = document.getElementById("vstatus");
  if (currentVideoIndex > 0) {
    currentVideoIndex--;
    const prevVideo = videoListArray[currentVideoIndex];
    const filename = currentPath
      ? `${currentPath}/${prevVideo.name}`
      : prevVideo.name;
    mapstoreIndex.set(currentPath, currentVideoIndex);
    focusCurrentItemVideoExplorer(currentVideoIndex);

    playVideo(filename);
  } else {
    const storeText = vstatusDiv.textContent;
    if (currentVideoIndex === -1) {
      vstatusDiv.textContent = "No previous video available.";
    } else {
      vstatusDiv.textContent = "No previous video available.";
      setTimeout(() => {
        vstatusDiv.textContent = storeText;
      }, 500);
    }
  }
}

const hamburgerBtn = document.getElementById("hamburger-btn");

hamburgerBtn.addEventListener("click", function () {
  document.getElementById("container").classList.toggle("shrink");
});

const downloadAndconvertSelectBtn = document.getElementById("feature-dc");
const downloadSelectBtn = document.getElementById("feature-d");
const convertSelectBtn = document.getElementById("feature-c");
downloadAndconvertSelectBtn.addEventListener("click", function () {
  document.getElementById("youtube-downloader-and-convertor").style.display =
    "block";
  document.getElementById("video-convertor").style.display = "none";
  document.getElementById("youtube-downloader").style.display = "none";
  downloadAndconvertSelectBtn.style.backgroundColor = "#f98a8a";
  downloadSelectBtn.style.backgroundColor = "#ffffff";
  convertSelectBtn.style.backgroundColor = "#ffffff";
});

downloadSelectBtn.addEventListener("click", function () {
  document.getElementById("youtube-downloader-and-convertor").style.display =
    "none";
  document.getElementById("video-convertor").style.display = "none";
  document.getElementById("youtube-downloader").style.display = "block";
  downloadAndconvertSelectBtn.style.backgroundColor = "#ffffff";
  downloadSelectBtn.style.backgroundColor = "#f98a8a";
  convertSelectBtn.style.backgroundColor = "#ffffff";
});

convertSelectBtn.addEventListener("click", function () {
  document.getElementById("youtube-downloader-and-convertor").style.display =
    "none";
  document.getElementById("video-convertor").style.display = "block";
  document.getElementById("youtube-downloader").style.display = "none";
  downloadAndconvertSelectBtn.style.backgroundColor = "#ffffff";
  downloadSelectBtn.style.backgroundColor = "#ffffff";
  convertSelectBtn.style.backgroundColor = "#f98a8a";
});

const checkbox = document.getElementById("toggle-checkbox");
const featureDiv = document.getElementById("featureDiv");
checkbox.addEventListener("change", function () {
  if (this.checked) {
    setTimeout(() => {
      featureDiv.style.overflow = "visible";
    }, 300);
    featureDiv.classList.add("show");
  } else {
    featureDiv.style.overflow = "hidden";
    featureDiv.classList.remove("show");
  }
});

///////////////////////////////////////////////////////////////////////////////////////////

function initializeBrowseFeature() {
  const browseButton = document.getElementById("browseButton");
  const dropbrowseBox = document.getElementById("drop-browse-box");
  const folderList = document.getElementById("browse-box-folder-list-ul");
  const fileList = document.getElementById("browse-box-file-list-ul");
  browseButton.addEventListener("click", () => {
    const overlay = document.getElementById("overlay");
    if (!overlay.style.display) {
      overlay.style.display = "none";
    }
    if (overlay.style.display === "none") {
      overlay.style.display = "block";
    } else {
      overlay.style.display = "none";
    }
    if (
      dropbrowseBox.style.maxHeight === "0px" ||
      dropbrowseBox.style.maxHeight === ""
    ) {
      dropbrowseBox.style.maxHeight = "200px";
      browseButton.innerText = "ok";
    } else {
      dropbrowseBox.style.maxHeight = "0px";
      browseButton.innerText = "Browse";
    }

    fetchAndDisplayBrowseVideos();
  });

  document
    .getElementById("input-container-bar-c")
    .addEventListener("click", (e) => {
      const name = e.target.getAttribute("data-name");
      const localvideoPath = document.getElementById("localvideoPath");
      let visiblepath = localvideoPath.value;

      if (name === "..") {
        const visiblepathParts = visiblepath.split("/");
        const lastDoc = visiblepathParts.pop();

        if (lastDoc.includes(".")) {
          visiblepath = visiblepathParts.join("/");
          localvideoPath.value = visiblepath;
          const allItems = document.querySelectorAll(
            "#browse-box-file-list-ul li"
          );
          allItems.forEach((item) => item.classList.remove("clicked-item"));
        } else {
          const pathParts = browsePath.split("/");
          pathParts.pop();
          browsePath = pathParts.join("/");
          selectedBrowseFile = "";
          fetchAndDisplayBrowseVideos();
        }
      }
    });

  folderList.addEventListener("click", (e) => {
    if (e.target && e.target.nodeName === "LI") {
      const isDir = e.target.getAttribute("data-is-dir") === "true";
      const name = e.target.getAttribute("data-name");

      if (isDir) {
        browsePath = browsePath ? `${browsePath}/${name}` : name;
        selectedBrowseFile = "";
        fetchAndDisplayBrowseVideos();
      }
    }
  });

  fileList.addEventListener("click", (e) => {
    if (e.target && e.target.nodeName === "LI") {
      const name = e.target.getAttribute("data-name");
      const localvideoPath = document.getElementById("localvideoPath");

      selectedBrowseFile = name;
      const filePath = browsePath ? `${browsePath}/${name}` : name;
      localvideoPath.value = filePath;

      const allItems = document.querySelectorAll("#browse-box-file-list-ul li");
      allItems.forEach((item) => item.classList.remove("clicked-item"));
      e.target.classList.toggle("clicked-item");
    }
  });
}

async function fetchAndDisplayBrowseVideos() {
  try {
    const response = await fetch(
      `http://127.0.0.1:5000/browse_videos?path=${browsePath}`
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    if (data.error) {
      console.log(data.error);
      return;
    }

    const folder = data.filter((item) => item.is_dir);
    const file = data.filter((item) => !item.is_dir);

    const folderList = document.getElementById("browse-box-folder-list-ul");
    const fileList = document.getElementById("browse-box-file-list-ul");
    folderList.innerHTML = "";
    fileList.innerHTML = "";

    folder.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.name;
      li.setAttribute("data-name", item.name);
      li.setAttribute("data-is-dir", "true");
      folderList.appendChild(li);
    });

    file.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.name;
      li.setAttribute("data-name", item.name);
      li.setAttribute("data-is-dir", "false");
      fileList.appendChild(li);
    });

    const localvideoPath = document.getElementById("localvideoPath");
    if (selectedBrowseFile) {
      localvideoPath.value = `${browsePath}/${selectedBrowseFile}`;
    } else {
      localvideoPath.value = browsePath
        ? browsePath
        : "No file/folder selected";
    }
  } catch (error) {
    console.log("Failed to browse videos: " + error.message);
  }
}

function initializeConvertor() {
  document
    .getElementById("convertButton")
    .addEventListener("click", async () => {
      const filename = document.getElementById("localvideoPath").value;
      const cstatusDiv = document.getElementById("cstatus");

      if (!filename) {
        cstatusDiv.textContent = "Please browse a file/folder to convert.";
        return;
      }

      try {
        if (currentconvertTask) {
          // Cancel the current task
          cstatusDiv.textContent = "Cancelling previous task...";
          currentconvertTask.cancel();
          currentconvertTask = null;
        }

        currentconvertTask = createConvertTask(filename, cstatusDiv);
        await currentconvertTask.run();
        currentconvertTask = null;
      } catch (error) {
        cstatusDiv.textContent = `Request failed: ${error.message}`;
      }
    });
}

function createConvertTask(filename, cstatusDiv) {
  let isCancelled = false;

  return {
    cancel() {
      isCancelled = true;
    },
    async run() {
      // Remove leading slash if present
      if (filename.startsWith("/")) {
        filename = filename.slice(1);
      }

      cstatusDiv.textContent = "Converting...";

      const response = await fetch(
        `http://127.0.0.1:5000/convert/${filename}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filename }),
        }
      );

      if (isCancelled) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Convert failed");
      }

      const data = await response.json();
      document.getElementById("localvideoPath").value = "";
      cstatusDiv.textContent = "Item added to explorer.";

      fetchAvailableVideos();
      setTimeout(() => {
        cstatusDiv.textContent = "Conversion Status";
      }, 3000);
    },
  };
}

function initializeDownloader() {
  document
    .getElementById("downloadButton")
    .addEventListener("click", async () => {
      const youtubeUrl = document.getElementById("youtubeUrl-d").value;
      const dstatusDiv = document.getElementById("dstatus");

      if (!youtubeUrl) {
        dstatusDiv.textContent = "Please enter a valid YouTube URL.";
        return;
      }

      try {
        if (currentdownloadTask) {
          // Cancel the current task
          dstatusDiv.textContent = "Cancelling previous task...";
          currentdownloadTask.cancel();
          currentdownloadTask = null;
        }

        currentdownloadTask = createDownloadTask(youtubeUrl, dstatusDiv);
        await currentdownloadTask.run();
        currentdownloadTask = null;
      } catch (error) {
        dstatusDiv.textContent = `Request failed: ${error.message}`;
      }
    });
}

function createDownloadTask(youtubeUrl, dstatusDiv) {
  let isCancelled = false;

  return {
    cancel() {
      isCancelled = true;
    },
    async run() {
      if (isYouTubeUrl(youtubeUrl)) {
        await handleYouTubeUrl(youtubeUrl, dstatusDiv);
      } else {
        dstatusDiv.textContent = "Please enter a valid YouTube URL.";
      }
    },
  };

  async function handleYouTubeUrl(youtubeUrl, dstatusDiv) {
    dstatusDiv.textContent = "Downloading...";

    const response = await fetch("http://127.0.0.1:5000/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: youtubeUrl }),
    });

    if (isCancelled) {
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Download failed");
    }

    const data = await response.json();
    dstatusDiv.textContent = "Item added to browse.";
    fetchAndDisplayBrowseVideos();
  }
}

const overlay = document.getElementById("overlay");
const BrowseButton = document.getElementById("browseButton");

document.body.addEventListener("click", (e) => {
  if (e.target === overlay) {
    BrowseButton.click();
  }
});

const videoPlayer = document.getElementById("videoPlayer");
videoPlayer.addEventListener("click", () => {
  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
});

/////////////////////////////////////////////

// Optionally, handle window resize events
// window.addEventListener("resize", adjustBarHeight);

/// adjust side and right bar height

function adjustBarHeight() {
  const rightBar = document.querySelector(".right-bar");
  const sideBar = document.querySelector(".side-bar");
  const explorerheadHeight =
    document.querySelector(".explorer-head").offsetHeight;
  const explorerbreadcrumbHeight =
    document.querySelector(".breadcrumb-bar").offsetHeight;
  const exploreList = document.getElementById("exploreList");

  const rightBarHeight = rightBar.offsetHeight;

  sideBar.style.height = `${rightBarHeight}px`;
  exploreList.style.height = `${
    rightBarHeight - explorerheadHeight - explorerbreadcrumbHeight
  }px`;

  // Adjust height of folderSection and videoSection
  const folderSection = document.querySelector(".folderSection");
  const videoSection = document.querySelector(".videoSection");

  const exploreListHeight = exploreList.offsetHeight - 10 - 12 - 4;
  const sectionHeight = exploreListHeight / 2;

  // Adjust height of folderListDiv and videoListDiv
  const folderHeader = document.querySelector(".folder-header");
  const videoHeader = document.querySelector(".video-header");
  const folderListDiv = document.querySelector(".folderListDiv");
  const videoListDiv = document.querySelector(".videoListDiv");
  const folderListul = document.getElementById("folderList-ul");
  const videoListul = document.getElementById("videoList-ul");

  const folderListulItems = folderListul.children.length;
  const videoListulItems = videoListul.children.length;
  const folderHeaderHeight = folderHeader.offsetHeight;
  const videoHeaderHeight = videoHeader.offsetHeight;
  if (folderListulItems === 0 || videoListulItems === 0) {
    if (
      folderSection.style.display === "none" &&
      videoSection.style.display === "none"
    ) {
      const emptySection = document.getElementById("emptySection");
      emptySection.style.display = "block";
      console.log("emptySection is called case 1");
    } else if (folderListulItems === 0) {
      videoListDiv.style.height = `${
        exploreListHeight - folderHeaderHeight - 8
      }px`;
      console.log("zero folder case 7");
    } else if (videoListulItems === 0) {
      folderListDiv.style.height = `${
        exploreListHeight - videoHeaderHeight - 8
      }px`;
      folderSection.style.marginBottom = "0px";
      console.log("zero video case 6");
    }
  } else {
    folderSection.style.marginBottom = "10px";
    folderListDiv.style.height = `${sectionHeight - folderHeaderHeight}px`;
    videoListDiv.style.height = `${sectionHeight - videoHeaderHeight}px`;
    adjustBarHeightAgain();
  }
}

function adjustBarHeightAgain() {
  const folderListul = document.getElementById("folderList-ul");
  const folderListDiv = document.querySelector(".folderListDiv");
  const videoListDiv = document.querySelector(".videoListDiv");
  const videoListul = document.getElementById("videoList-ul");

  const folderListulHeight = folderListul.offsetHeight;
  const folderListDivHeight = folderListDiv.offsetHeight;
  const videoListulHeight = videoListul.offsetHeight;
  const videoListDivHeight = videoListDiv.offsetHeight;
  if (folderListulHeight < folderListDivHeight) {
    folderListDiv.style.height = `${folderListulHeight}px`;
    videoListDiv.style.height = `${
      videoListDiv.offsetHeight + (folderListDivHeight - folderListulHeight)
    }px`;
  } else if (videoListulHeight < videoListDivHeight) {
    videoListDiv.style.height = `${videoListulHeight}px`;
    folderListDiv.style.height = `${
      folderListDiv.offsetHeight + (videoListDivHeight - videoListulHeight)
    }px`;
  }
}
const rightBar = document.querySelector(".right-bar");
const observer = new ResizeObserver(adjustBarHeight);
observer.observe(rightBar, { childList: true, subtree: true });

///altering image or text from video
function videoBlock() {
  const videoPlayer = document.getElementById("videoPlayer");
  const placeholder = document.getElementById("placeholder");

  videoPlayer.style.display = "block";
  placeholder.style.display = "none";
}

function videoNone() {
  const videoPlayer = document.getElementById("videoPlayer");
  const placeholder = document.getElementById("placeholder");

  videoPlayer.style.display = "none";
  placeholder.style.display = "block";
}
//////////form validation

async function submitForm(event) {
  event.preventDefault();

  const folderPath = document.getElementById("folder_path").value;
  const formData = new FormData();
  formData.append("folder_path", folderPath);

  try {
    const response = await fetch("http://127.0.0.1:5000/set_paths", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (response.ok) {
      document.getElementById("response").innerText = `${result.message}`; //successfully set path
      fetchAvailableVideos();
      document.getElementById("folder_path").value = "";
      // const storeCurrentPath = document.getElementById("storeCurrentPath");
      // storeCurrentPath.innerText = `${folderPath}`;
      // const megaoverlay = document.getElementById("megaoverlay");
      // const chooseSpace = document.getElementById("chooseSpace");
      // megaoverlay.style.display = "none";
      // chooseSpace.style.display = "none";
    } else {
      document.getElementById("response").innerText = `Error: ${result.error}`;
    }
  } catch (error) {
    document.getElementById("response").innerText = `Request failed: ${error}`;
  }
  document.getElementById("response").style.display = "block";
  setTimeout(() => {
    document.getElementById("response").innerText = "";
    document.getElementById("response").style.display = "none";
  }, 2000);
}

const explorerHead = document.getElementById("explorer-head");
explorerHead.addEventListener("click", () => {
  const chooseSpace = document.getElementById("chooseSpace");
  chooseSpace.classList.toggle("makeVisible");
});

explorerHead.addEventListener("mouseover", () => {
  const tooltip = document.getElementById("tooltip");
  tooltip.classList.add("onhover");
  setTimeout(() => {
    tooltip.classList.remove("onhover");
  }, 3000);
  fetchPaths();
});
explorerHead.addEventListener("mouseout", () => {
  const tooltip = document.getElementById("tooltip");
  tooltip.classList.remove("onhover");
});

async function fetchPaths() {
  try {
    const response = await fetch("http://127.0.0.1:5000/get_paths");
    const result = await response.json();
    if (!result || !result.DOWNLOAD_DIR) {
      document.getElementById("tooltip").innerText = "Set the workspace";
    } else {
      if (response.ok) {
        const paths = result.DOWNLOAD_DIR.split("\\");
        paths.pop();
        const newpaths = paths.join("\\");
        document.getElementById("tooltip").innerText = `${newpaths}`;
      } else {
        document.getElementById("tooltip").innerText = `Error: ${result.error}`;
      }
    }
  } catch (error) {
    document.getElementById("tooltip").innerText = `(server band hai! ) Request failed: ${error}`;
  }
}
