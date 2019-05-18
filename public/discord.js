(function() {
	const getStarted = document.getElementById("discord");
	const contactUs = document.getElementById("contact");
	const hideClass = "hidden";

	function handleRadioEvent(e) {
		handleRadio(e.target);
	}

	function handleRadio(e) {
		if (e.checked) {
			switch (e.value) {
				case "contact":
					if (!getStarted.classList.contains(hideClass)) {
						getStarted.classList.add(hideClass);
					}
					contactUs.classList.remove(hideClass);
					break;
				default:
					if (!contactUs.classList.contains(hideClass)) {
						contactUs.classList.add(hideClass);
					}
					getStarted.classList.remove(hideClass);
					break;
			}
		}
	}

	const radios = Array.from(document.querySelectorAll("input[name=applicant-type]"));
	radios.forEach(r => {
		r.onchange = handleRadioEvent;
		handleRadio(r);
	});
})();
