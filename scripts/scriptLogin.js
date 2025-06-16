const passWordInput = document.querySelector("#input-password"); // Selecciona el input de la contraseña
const btnStatePassword = document.querySelector(".btn-hide-show"); // Selecciona el botón del ojo

const showPasswordIcon = document.querySelector("#show-password"); // El icono de ojo abierto (sin tachar)
const hidePasswordIcon = document.querySelector("#hide-password"); // El icono de ojo tachado

// --- Ajuste del estado inicial al cargar la página ---
// Esta sección asegura que el icono correcto esté visible desde el principio,
// independientemente de cómo el navegador autocomplete el campo.
if (passWordInput.type === "password") {
	// Si la contraseña está oculta (por defecto o autocompletado),
	// muestra el ojo abierto y oculta el ojo tachado.
	showPasswordIcon.style.display = "block";
	hidePasswordIcon.style.display = "none";
} else {
	// Si la contraseña está visible (ej. si el navegador la autocompletó como texto),
	// muestra el ojo tachado y oculta el ojo abierto.
	showPasswordIcon.style.display = "none";
	hidePasswordIcon.style.display = "block";
}
// --- Fin del ajuste del estado inicial ---

// Añade un 'event listener' al botón para detectar clics
btnStatePassword.addEventListener("click", () => {
	// Verifica el tipo actual del campo de contraseña
	if (passWordInput.type === "password") {
		// Si la contraseña está actualmente oculta (type="password"):
		// 1. Cambia el tipo del input a "text" para hacerla visible.
		passWordInput.type = "text";
		// 2. Oculta el icono de ojo abierto y muestra el icono de ojo tachado.
		showPasswordIcon.style.display = "none";
		hidePasswordIcon.style.display = "block";
	} else {
		// Si la contraseña está actualmente visible (type="text"):
		// 1. Cambia el tipo del input a "password" para ocultarla.
		passWordInput.type = "password";
		// 2. Oculta el icono de ojo tachado y muestra el icono de ojo abierto.
		showPasswordIcon.style.display = "block";
		hidePasswordIcon.style.display = "none";
	}
});
