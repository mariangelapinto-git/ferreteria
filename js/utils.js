// ./js/utils.js

// Función para mostrar notificaciones Toast de Bootstrap
function showToast(message, type = "info", duration = 3000) {
	const toastContainer = document.getElementById("toastContainer");

	// Si el contenedor no existe, créalo (esto es una mejora si no lo tienes en tu HTML)
	// Aunque se recomienda tenerlo estáticamente en el HTML para evitar problemas de timing.
	if (!toastContainer) {
		const newToastContainer = document.createElement("div");
		newToastContainer.id = "toastContainer";
		newToastContainer.classList.add(
			"toast-container",
			"position-fixed",
			"bottom-0",
			"end-0",
			"p-3"
		);
		document.body.appendChild(newToastContainer);
		// Si acabamos de crear el contenedor, llamamos de nuevo la función para que se cree el toast en él.
		// Esto evita errores si la función es llamada antes de que el DOM esté completamente cargado y el contenedor exista.
		return showToast(message, type, duration);
	}

	const toastElement = document.createElement("div");
	toastElement.classList.add("toast", `text-bg-${type}`, "border-0");
	toastElement.setAttribute("role", "alert");
	toastElement.setAttribute("aria-live", "assertive");
	toastElement.setAttribute("aria-atomic", "true");
	toastElement.setAttribute("data-bs-autohide", "true");
	toastElement.setAttribute("data-bs-delay", duration);

	toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

	toastContainer.appendChild(toastElement);

	const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastElement);
	toastBootstrap.show();

	// Eliminar el toast del DOM después de que se oculte para evitar acumulación
	toastElement.addEventListener("hidden.bs.toast", () => {
		toastElement.remove();
	});
}
