window.addEventListener("DOMContentLoaded", () => {
	const noticeDropdownBtn = document.getElementById("notice-dropdown-btn");
	const fileInput = document.getElementById("file_input");
	const results_container = document.getElementById("results");
	const audioEl = document.getElementById("audio");
	const overallSummaryContainer = document.getElementById(
		"overall-summary-container",
	);
	const songAnalysisContainer = document.getElementById(
		"song-analysis-container",
	);

	const lyricsVisualizer = document.getElementById("lyrics-visualizer");
	let timestamps = [];
	let lines = [];
	lines.push("...");

	const themeColors = {
		nostalgia: "#FFE8CC",
		heartbreak: "#FFD7D7",
		hope: "#C7E9F5",
		loneliness: "#D0E8F2",
		love: "#FFD9E8",
		joy: "#FFFBEA",
		sadness: "#D9E3F0",
		anger: "#FFD9B3",
		empowerment: "#D9F0D0",
		loss: "#E8D9F0",
		freedom: "#C7E9F5",
		regret: "#E8E8E8",
		despair: "#D9D9D9",
	};

	function formatTimestamp(ts) {
		let newTs = ts.replace("[", "");
		newTs = newTs.replace("]", "");

		let [minute, seconds] = newTs.split(":");

		return parseInt(minute) * 60 + parseFloat(seconds);
	}

	function escapeHtml(str) {
		return String(str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/\n/g, " ")
			.replace(/\r/g, " ");
	}

	async function handleUpload() {
		timestamps = [];
		lines = [];
		lyricsVisualizer.innerHTML = "";
		// results_container.innerHTML = ""
		const loading = document.getElementById("loading");

		loading.style.display = "block";
		const file = fileInput.files[0];
		const formData = new FormData();
		if (fileInput.files.length > 0) {
			formData.append("file", file);
		}

		const audioUrl = URL.createObjectURL(file);
		audioEl.src = audioUrl;
		audioEl.load();

		try {
			const response = await fetch("/analyze", {
				method: "POST",
				body: formData,
			});

			const data = await response.json();
			const song_data = data.data;
			console.log(song_data);
			const sectionDefinitions =
				song_data.analyzed_lyrics?.sections || [];
			const overallSummary =
				song_data.analyzed_lyrics?.overall_summary || "";
			let topTags = song_data.top_tags.toptags.tag;
			console.log(data);
			lyrics = song_data.lyrics;

			console.log(sectionDefinitions);
			console.log(lyrics);

			if (song_data) {
				audioEl.style.display = "block";
				if (!song_data.lines || song_data.lines.length === 0) {
					results_container.innerHTML +=
						'<p style="color: red;">Lyrics cannot be found. Please try again.</p>';
					return;
				}
				overallSummaryContainer.style.display = "block";
				overallSummaryContainer.innerHTML += `<p>${overallSummary}</p>`;
				songAnalysisContainer.innerHTML += `
		<div class="song_analysis_container">
		  <h3 class="title"style="margin-top: 0;">Song Analysis</h3>
		  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95em;">
			<div><strong>Tempo:</strong> ${song_data.tempo}</div>
			<div><strong>Pace:</strong> ${song_data.pace}</div>
			<div><strong>Duration:</strong> ${song_data.duration}</div>
			<div><strong>Energy:</strong> ${song_data.energy}</div>
			<div><strong>Dynamic Range:</strong> ${song_data.dynamic_range}</div>
		  </div>
		  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
			<h4 style="margin-top: 0; margin-bottom: 8px;">Overall Theme Rating</h4>
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
			  ${Object.entries(song_data.overall_theme_score)
					.map(
						([theme, score]) =>
							`<div><strong>${theme}:</strong> ${(score * 100).toFixed(2)}%</div>`,
					)
					.join("")}
			</div>
		  </div>

		  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
			<h4 style="margin-top: 0; margin-bottom: 8px;">Top tags</h4>
			<div style="display: flex; flex-wrap: wrap; flex-direction: row; gap:4px; ">${
				topTags.length > 0
					? topTags.map((tag) => `<p>${tag.name}</p>`)
					: `<p>There are no <b>top tags</b> for this track.</p>`
			}</div>
		  </div>
		</div>`;

				const syllables = [];
				let maxSyllables = 0;

				const lyricsContainer =
					document.getElementById("lyrics-container");
				const syllablesContainer = document.getElementById(
					"syllables-container",
				);

				// get max syllables
				song_data.lines &&
					song_data.lines.forEach((line_data) => {
						syllables.push(line_data.total_syllables);
					});

				maxSyllables = Math.max(...syllables);

				song_data.lines &&
					song_data.lines.forEach((line_data) => {
						const scores = line_data.theme_scores.map(
							(theme) => theme.score,
						);
						const line = line_data.line
							.split(" ")
							.slice(1)
							.join(" ");
						const section = sectionDefinitions.find(
							(section) =>
								section.lyrics && section.lyrics.includes(line),
						);
						const sectionExplanation = section?.explanation
							? section.explanation
							: "";
						const sectionName = section?.section_name
							? section.section_name
							: "";

						if (line == "") return;

						const timestamp = line_data.line.split(" ")[0];
						timestamps.push(formatTimestamp(timestamp));
						lines.push(line);
						const maxScore = Math.max(...scores);
						const bestThemeObj = line_data.theme_scores.filter(
							(theme) => theme.score == maxScore,
						)[0];
						const bestTheme = bestThemeObj.theme;
						const bestScore = (bestThemeObj.score * 100).toFixed(0);
						const bgColor = themeColors[bestTheme] || "#FFFFFF";

						lyricsContainer.innerHTML += `
		  <div class="verse-row" style="display: flex; align-items: center; gap: 10px; position: relative;">
			<div class="verse-explanation" style="display:none; position:absolute; top:110%; left:0; background:#fff; border:1px solid #ddd; padding:8px; border-radius:6px; width:320px; box-shadow:0 6px 18px rgba(0,0,0,0.08); z-index:10;">
			  <strong class='section-name'>${escapeHtml(sectionName)}</strong>
			  <p>${escapeHtml(sectionExplanation)}</p>
			</div>
			<span
			  style="
				background-color: ${bgColor};
				padding: 2px 4px;
				border-radius: 2px;
				margin-right: 8px;
				font-size: 0.8em;
				display: inline-block;
				font-weight: lighter;
				color: #333;
				"
				>${timestamp}
			</span>
			<mark
			  style="
				background-color: ${bgColor};
				"
			>${line}
			<sup
			  style="
				font-size: 0.7em;
				opacity: 0.7;"
			  >
				${bestTheme} ${bestScore}%
			  </sup>
			</mark>

			<progress
			   value="${line_data.total_syllables}"
			   max="${maxSyllables}"
			   style="width: 80px; flex-shrink: 0;"
			 ></progress>
			 <sup
			   style="
				 font-size: 0.7em;
				 opacity: 0.7;"
			   >
				 ${line_data.total_syllables} syllables
			   </sup>
		  </div>
			`;
					});
				// syllables.forEach((value) => {
				//   syllablesContainer.innerHTML += `
				//   <div style="display: flex; flex-direction: column;">
				//     <progress value=${value} max="${maxSyllables}"></progress>
				//     <br>
				//   </div>
				//   `
				// })

				// toggle explanation when a verse row is clicked
				lyricsContainer.addEventListener("click", (e) => {
					const row = e.target.closest(".verse-row");
					if (!row) return;
					const expl = row.querySelector(".verse-explanation");
					if (!expl) return;
					const isVisible =
						expl.style.display && expl.style.display !== "none";
					// hide other open explanations
					document
						.querySelectorAll(".verse-explanation")
						.forEach((el) => {
							if (el !== expl) el.style.display = "none";
						});
					expl.style.display = isVisible ? "none" : "block";
				});

				console.log(timestamps);
				console.log(lines);
			}
		} catch (error) {
			// results_container.innerHTML = ""
			console.log(error);
		} finally {
			loading.style.display = "none";
		}
	}

	noticeDropdownBtn.addEventListener("click", () => {
		document.getElementById("notice").classList.toggle("active");
	});

	fileInput.addEventListener("change", handleUpload);

	let currentIndex = -1;
	audioEl.addEventListener("timeupdate", () => {
		const seconds = audioEl.currentTime;
		let index = -1;

		for (let i = 0; i < timestamps.length; i++) {
			console.log(seconds, timestamps[i]);
			if (seconds >= timestamps[i]) {
				index = i;
			}
		}

		if (currentIndex !== index) {
			console.log(lines[currentIndex]);
			currentIndex = index;
			if (lines[currentIndex]) {
				lyricsVisualizer.innerHTML = `<p class="lyrics">${lines[currentIndex]}</p>`;
			} else {
				lyricsVisualizer.innerHTML = "";
			}
		}
	});
});
