// server.js

// 1. Importar módulos
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const multer = require("multer"); // <--- Importar Multer
const fs = require("fs"); // <--- Importar fs para manejo de archivos

// ===============================================
// Configuración inicial de Express y Socket.IO
// ===============================================
const app = express();
const PORT = 3000; // Puedes cambiar el puerto si lo necesitas

// Crear un servidor HTTP a partir de la aplicación Express
const server = http.createServer(app);

// Inicializar Socket.IO
const io = new Server(server, {
	cors: {
		origin: [
			"http://127.0.0.1:5500",
			"http://localhost:5500",
			"http://127.0.0.1:3000",
			"http://localhost:3000",
		],
		methods: ["GET", "POST", "PUT", "DELETE"],
	},
});

// 2. Middlewares globales
app.use(cors()); // Habilita CORS para todas las solicitudes HTTP
app.use(express.json()); // <--- ¡Importante! Habilitar para parsear cuerpos JSON
// Multer se usará específicamente en las rutas de productos que manejan FormData.

// ===============================================
// Configuración de Multer para la subida de imágenes
// ===============================================
const uploadsDir = path.join(__dirname, "img", "productos"); // Carpeta donde se guardarán las imágenes

// Asegurarse de que la carpeta de subidas exista
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadsDir); // Directorio donde se guardarán los archivos
	},
	filename: function (req, file, cb) {
		// Generar un nombre único para el archivo para evitar sobrescrituras
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname); // Obtener la extensión original del archivo
		cb(null, file.fieldname + "-" + uniqueSuffix + ext); // Nombre del archivo: por ejemplo, "imagen-16788888888.jpg"
	},
});

// Filtrar tipos de archivos (opcional, pero recomendado)
const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith("image/")) {
		cb(null, true);
	} else {
		cb(new Error("Solo se permiten archivos de imagen."), false);
	}
};

const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: { fileSize: 5 * 1024 * 1024 }, // Limite de tamaño de archivo (5MB)
});

// 3. Conexión a la base de datos SQLite
const DB_PATH = "./Config/productos.db"; // Ruta a tu archivo de base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		console.error("Error al conectar a la base de datos:", err.message);
	} else {
		console.log("Conectado a la base de datos SQLite.");

		// Creación de la tabla Productos
		db.run(
			`CREATE TABLE IF NOT EXISTS Productos (
                ID_Productos INTEGER PRIMARY KEY AUTOINCREMENT,
                NombreProducto TEXT NOT NULL,
                Descripcion TEXT,
                Precio REAL NOT NULL,
                Stock INTEGER NOT NULL,
                ImagenURL TEXT,  -- <--- Esta columna almacenará el nombre del archivo de la imagen
                Descuento REAL DEFAULT 0,
                FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                Unidad TEXT
            )`,
			(err) => {
				if (err) {
					console.error(
						"Error al crear la tabla Productos:",
						err.message
					);
				} else {
					console.log("Tabla 'Productos' asegurada/creada.");
				}
			}
		);

		// Creación de la tabla Ordenes
		db.run(
			`CREATE TABLE IF NOT EXISTS Ordenes (
                ID_Orden INTEGER PRIMARY KEY AUTOINCREMENT,
                FechaOrden TEXT NOT NULL,
                Total REAL NOT NULL,
                MetodoPago TEXT,
                Estado TEXT DEFAULT 'Pendiente'
            )`,
			(err) => {
				if (err) {
					console.error(
						"Error al crear la tabla Ordenes:",
						err.message
					);
				} else {
					console.log("Tabla 'Ordenes' asegurada/creada.");
				}
			}
		);

		// **NUEVA TABLA: DetalleOrdenes**
		db.run(
			`CREATE TABLE IF NOT EXISTS DetalleOrdenes (
                ID_DetalleOrden INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_Orden INTEGER NOT NULL,
                ID_Producto INTEGER NOT NULL,
                Cantidad INTEGER NOT NULL,
                PrecioUnitario REAL NOT NULL,
                DescuentoAplicado REAL DEFAULT 0,
                FOREIGN KEY (ID_Orden) REFERENCES Ordenes(ID_Orden) ON DELETE CASCADE,
                FOREIGN KEY (ID_Producto) REFERENCES Productos(ID_Productos) ON DELETE NO ACTION
            )`,
			(err) => {
				if (err) {
					console.error(
						"Error al crear la tabla DetalleOrdenes:",
						err.message
					);
				} else {
					console.log("Tabla 'DetalleOrdenes' asegurada/creada.");
				}
			}
		);
	}
});

// 4. Rutas de la API (Endpoints)
// =============================================================================
//  API de Productos
// =============================================================================

// Obtener todos los productos
app.get("/api/productos", (req, res) => {
	const sql = "SELECT * FROM Productos";
	db.all(sql, [], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(rows);
	});
});

// Obtener un solo producto por ID
app.get("/api/productos/:id", (req, res) => {
	const { id } = req.params;
	db.get(
		"SELECT * FROM Productos WHERE ID_Productos = ?",
		[id],
		(err, row) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (!row) {
				res.status(404).json({ message: "Producto no encontrado." });
				return;
			}
			res.json(row);
		}
	);
});

// Agregar un nuevo producto (solo para admin)
// Usamos upload.single('imagenProducto') para procesar la subida de un solo archivo
app.post("/api/productos", upload.single("imagenProducto"), (req, res) => {
	const { NombreProducto, Descripcion, Precio, Stock, Descuento, Unidad } =
		req.body;
	const ImagenURL = req.file ? req.file.filename : null; // Obtener el nombre del archivo subido

	if (!NombreProducto || !Precio || !Stock) {
		// Si falta algún campo obligatorio y se subió un archivo, eliminarlo para limpiar
		if (req.file) {
			fs.unlink(req.file.path, (err) => {
				if (err) console.error("Error al eliminar archivo:", err);
			});
		}
		return res
			.status(400)
			.json({ error: "Nombre, Precio y Stock son obligatorios." });
	}

	const sql = `INSERT INTO Productos (NombreProducto, Descripcion, Precio, Stock, ImagenURL, Descuento, Unidad) VALUES (?, ?, ?, ?, ?, ?, ?)`;
	db.run(
		sql,
		[
			NombreProducto,
			Descripcion,
			Precio,
			Stock,
			ImagenURL, // Usar el nombre del archivo generado por Multer
			Descuento || 0,
			Unidad || null,
		],
		function (err) {
			if (err) {
				// Si hay un error en la DB, eliminar el archivo subido
				if (req.file) {
					fs.unlink(req.file.path, (err) => {
						if (err)
							console.error(
								"Error al eliminar archivo después de error DB:",
								err
							);
					});
				}
				res.status(500).json({ error: err.message });
				return;
			}
			io.emit("productosActualizados");
			res.status(201).json({
				message: "Producto agregado con éxito",
				id: this.lastID,
				ImagenURL: ImagenURL, // Devolver el nombre del archivo para confirmación
			});
		}
	);
});

// Actualizar un producto existente (solo para admin)
// upload.single('imagenProducto') también para la actualización
app.put("/api/productos/:id", upload.single("imagenProducto"), (req, res) => {
	const { id } = req.params;
	const { NombreProducto, Descripcion, Precio, Stock, Descuento, Unidad } =
		req.body;
	let ImagenURL = req.file ? req.file.filename : req.body.ImagenURL; // Si se sube nuevo archivo, usarlo; de lo contrario, usar el existente

	const sql = `UPDATE Productos SET
                 NombreProducto = COALESCE(?, NombreProducto),
                 Descripcion = COALESCE(?, Descripcion),
                 Precio = COALESCE(?, Precio),
                 Stock = COALESCE(?, Stock),
                 ImagenURL = COALESCE(?, ImagenURL), -- Actualizar la URL de la imagen
                 Descuento = COALESCE(?, Descuento),
                 Unidad = COALESCE(?, Unidad)
                 WHERE ID_Productos = ?`;

	db.run(
		sql,
		[
			NombreProducto,
			Descripcion,
			Precio,
			Stock,
			ImagenURL, // Usar la nueva URL de la imagen o la existente
			Descuento,
			Unidad,
			id,
		],
		function (err) {
			if (err) {
				// Si hay un error en la DB, eliminar el archivo subido (si hubo uno)
				if (req.file) {
					fs.unlink(req.file.path, (err) => {
						if (err)
							console.error(
								"Error al eliminar archivo después de error DB:",
								err
							);
					});
				}
				res.status(500).json({ error: err.message });
				return;
			}
			if (this.changes === 0) {
				// Si no se encontró el producto o no hubo cambios, eliminar el archivo subido
				if (req.file) {
					fs.unlink(req.file.path, (err) => {
						if (err)
							console.error(
								"Error al eliminar archivo (producto no encontrado/sin cambios):",
								err
							);
					});
				}
				res.status(404).json({
					message: "Producto no encontrado o sin cambios.",
				});
				return;
			}
			// Si la actualización fue exitosa y se subió una nueva imagen,
			// podrías querer eliminar la imagen antigua de la carpeta 'productos'
			// Para hacer esto, necesitarías obtener la ImagenURL antigua antes de la actualización.
			// Por simplicidad, no lo implementamos aquí, pero es una consideración para producción.

			io.emit("productosActualizados");
			res.json({
				message: "Producto actualizado con éxito",
				ImagenURL: ImagenURL,
			});
		}
	);
});

// Eliminar un producto (solo para admin)
app.delete("/api/productos/:id", (req, res) => {
	const { id } = req.params;

	// Opcional: Obtener la ImagenURL antes de eliminar el producto para poder eliminar el archivo físico
	db.get(
		"SELECT ImagenURL FROM Productos WHERE ID_Productos = ?",
		[id],
		(err, row) => {
			if (err) {
				return res.status(500).json({ error: err.message });
			}
			if (row && row.ImagenURL) {
				const imagePath = path.join(uploadsDir, row.ImagenURL);
				fs.unlink(imagePath, (err) => {
					if (err)
						console.error(
							"Error al eliminar archivo de imagen:",
							err
						);
				});
			}

			db.run(
				"DELETE FROM Productos WHERE ID_Productos = ?",
				[id],
				function (err) {
					if (err) {
						res.status(500).json({ error: err.message });
						return;
					}
					if (this.changes === 0) {
						res.status(404).json({
							message: "Producto no encontrado.",
						});
						return;
					}
					io.emit("productosActualizados");
					res.json({ message: "Producto eliminado con éxito" });
				}
			);
		}
	);
});

// =============================================================================
//  API de Órdenes y Compras
// =============================================================================

// Ruta para finalizar una compra (procesar el carrito)
app.post("/api/compras", async (req, res) => {
	// express.json() ya parsea el body para esta ruta
	const { productosComprados, totalCompra, metodoPago } = req.body;

	if (
		!productosComprados ||
		!Array.isArray(productosComprados) ||
		productosComprados.length === 0 ||
		totalCompra === undefined
	) {
		return res
			.status(400)
			.json({ message: "Datos de compra incompletos o inválidos." });
	}

	let orderId;

	try {
		await new Promise((resolve, reject) => {
			db.run("BEGIN TRANSACTION", (err) => {
				if (err) return reject(err);
				resolve();
			});
		});

		// 1. Insertar la nueva orden en la tabla 'Ordenes'
		const fechaOrden = new Date().toISOString();
		const insertOrderSql =
			"INSERT INTO Ordenes (FechaOrden, Total, MetodoPago, Estado) VALUES (?, ?, ?, ?)";

		const orderResult = await new Promise((resolve, reject) => {
			db.run(
				insertOrderSql,
				[
					fechaOrden,
					totalCompra,
					metodoPago || "Desconocido",
					"Completada",
				],
				function (err) {
					if (err) return reject(err);
					resolve(this);
				}
			);
		});
		orderId = orderResult.lastID;

		// 2. Iterar sobre los productos comprados para actualizar stock e insertar detalles de la orden
		for (const item of productosComprados) {
			const { ID_Producto, Cantidad, PrecioUnitario, DescuentoAplicado } =
				item;

			// Verificar stock y reducirlo
			const productRow = await new Promise((resolve, reject) => {
				db.get(
					"SELECT Stock FROM Productos WHERE ID_Productos = ?",
					[ID_Producto],
					(err, row) => {
						if (err) return reject(err);
						resolve(row);
					}
				);
			});

			if (!productRow || productRow.Stock < Cantidad) {
				throw new Error(
					`Stock insuficiente para el producto ID ${ID_Producto}.`
				);
			}

			const newStock = productRow.Stock - Cantidad;
			await new Promise((resolve, reject) => {
				db.run(
					"UPDATE Productos SET Stock = ? WHERE ID_Productos = ?",
					[newStock, ID_Producto],
					(err) => {
						if (err) return reject(err);
						resolve();
					}
				);
			});

			// Insertar detalle de la orden
			const insertDetailSql =
				"INSERT INTO DetalleOrdenes (ID_Orden, ID_Producto, Cantidad, PrecioUnitario, DescuentoAplicado) VALUES (?, ?, ?, ?, ?)";
			await new Promise((resolve, reject) => {
				db.run(
					insertDetailSql,
					[
						orderId,
						ID_Producto,
						Cantidad,
						PrecioUnitario,
						DescuentoAplicado || 0,
					],
					(err) => {
						if (err) return reject(err);
						resolve();
					}
				);
			});
		}

		await new Promise((resolve, reject) => {
			db.run("COMMIT", (err) => {
				if (err) return reject(err);
				resolve();
			});
		});

		io.emit("productosActualizados"); // Notifica a todos los clientes que el stock ha cambiado
		io.emit("ordenesActualizadas"); // Notifica que hay nuevas órdenes

		res.status(201).json({
			message: "Compra realizada con éxito.",
			orderId: orderId,
		});
	} catch (error) {
		console.error("Error al finalizar la compra:", error.message);
		db.run("ROLLBACK", (err) => {
			if (err) console.error("Error al hacer ROLLBACK:", err.message);
		});
		res.status(500).json({ error: error.message });
	}
});

// Obtener todas las órdenes con sus detalles
app.get("/api/ordenes", (req, res) => {
	const sql = `
        SELECT
            O.ID_Orden,
            O.FechaOrden,
            O.Total,
            O.MetodoPago,
            O.Estado,
            GROUP_CONCAT(P.NombreProducto || ' (x' || DO.Cantidad || ' @ $' || DO.PrecioUnitario || ')', ' || ') AS ProductosDetalle
        FROM
            Ordenes AS O
        LEFT JOIN
            DetalleOrdenes AS DO ON O.ID_Orden = DO.ID_Orden
        LEFT JOIN
            Productos AS P ON DO.ID_Producto = P.ID_Productos
        GROUP BY
            O.ID_Orden
        ORDER BY
            O.FechaOrden DESC;
    `;
	db.all(sql, [], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(rows);
	});
});

// Obtener detalles de una orden específica
app.get("/api/ordenes/:id", (req, res) => {
	const { id } = req.params;
	const sql = `
        SELECT
            O.ID_Orden,
            O.FechaOrden,
            O.Total,
            O.MetodoPago,
            O.Estado,
            DO.ID_DetalleOrden,
            DO.Cantidad,
            DO.PrecioUnitario,
            DO.DescuentoAplicado,
            P.ID_Productos,
            P.NombreProducto,
            P.ImagenURL
        FROM
            Ordenes AS O
        JOIN
            DetalleOrdenes AS DO ON O.ID_Orden = DO.ID_Orden
        JOIN
            Productos AS P ON DO.ID_Producto = P.ID_Productos
        WHERE
            O.ID_Orden = ?;
    `;
	db.all(sql, [id], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		if (rows.length === 0) {
			res.status(404).json({ message: "Orden no encontrada." });
			return;
		}

		// Reestructurar los resultados para agrupar los detalles de los productos por orden
		const order = {
			ID_Orden: rows[0].ID_Orden,
			FechaOrden: rows[0].FechaOrden,
			Total: rows[0].Total,
			MetodoPago: rows[0].MetodoPago,
			Estado: rows[0].Estado,
			productos: rows.map((row) => ({
				ID_DetalleOrden: row.ID_DetalleOrden,
				ID_Producto: row.ID_Productos,
				NombreProducto: row.NombreProducto,
				ImagenURL: row.ImagenURL,
				Cantidad: row.Cantidad,
				PrecioUnitario: row.PrecioUnitario,
				DescuentoAplicado: row.DescuentoAplicado,
			})),
		};
		res.json(order);
	});
});

// =============================================================================
//  Sirve archivos estáticos (HTML, CSS, JS, imágenes)
// =============================================================================
// Servir imágenes desde el directorio 'img/productos'
app.use("/img/productos", express.static(uploadsDir)); // <--- Nueva ruta para servir las imágenes subidas
app.use(express.static(path.join(__dirname)));
app.use("/img", express.static(path.join(__dirname, "img"))); // Para otras imágenes que no sean de productos

// 6. Iniciar el servidor (al final)
server.listen(PORT, () => {
	console.log(
		`Servidor Express y Socket.IO escuchando en http://localhost:${PORT}`
	);
	console.log(
		`Accede a la tienda en http://localhost:${PORT}/productos.html`
	);
	console.log(
		`Accede al panel de administración en http://localhost:${PORT}/admin.html`
	);
	console.log(
		`Accede a la lista de compras en http://localhost:${PORT}/compras.html`
	); // Nueva URL
});

// 7. Manejo de conexiones de Socket.IO
io.on("connection", (socket) => {
	console.log("Nuevo cliente Socket.IO conectado:", socket.id);

	socket.on("disconnect", () => {
		console.log("Cliente Socket.IO desconectado:", socket.id);
	});

	// Este es el evento para que el admin pueda forzar una actualización en los clientes de la tienda
	socket.on("productosActualizados", () => {
		console.log(
			"...Emitiendo evento 'productosActualizados' a todos los clientes."
		);
		io.emit("recargarProductos"); // Se enviará este evento a productos.html
	});

	// Evento para notificar actualizaciones de órdenes
	socket.on("ordenesActualizadas", () => {
		console.log(
			"...Emitiendo evento 'ordenesActualizadas' a todos los clientes."
		);
		io.emit("recargarOrdenes"); // Se enviará este evento a compras.html
	});
});
