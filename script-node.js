//importar dependencias
const axios = require('axios');
const https = require('https');
const fs = require('fs'); // Para manejar la escritura de archivos

// Definir las credenciales y la URL de la API
const api_url = "https://172.16.5.2/web_api";
const username = "automate";
const password = "ecuador.firewall";
const p12Password = "xalvarado";

// Crear una instancia de axios con un agente para deshabilitar la verificación SSL
const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false  // Desactiva la verificación SSL
    })
});

// Función genérica para manejar la autenticación y el cierre de sesión
async function withSession(func) {
    let sid;
    try {
        sid = await login();
        console.log('Autenticación exitosa. SID:', sid);

        await func(sid);  // Ejecuta la función que se le pasa (e.g. creación de usuario, renovación, etc.)

    } catch (error) {
        console.error('Error en la ejecución del script:', error.message);
    } finally {
        if (sid) {
            try {
                await publish(sid);  // Publicar antes de cerrar sesión
            } catch (publishError) {
                console.error('Error al publicar los cambios:', publishError.message);
            } finally {
                try {
                    await logout(sid);  // Cerrar sesión
                } catch (logoutError) {
                    console.error('Error al cerrar sesión:', logoutError.response ? logoutError.response.data : logoutError.message);
                }
            }
        }
    }
}

// Autenticarse en la API
async function login() {
    try {
        const response = await instance.post(`${api_url}/login`, {
            user: username,
            password: password
        });
        return response.data.sid;
    } catch (error) {
        console.error('Error en la autenticación:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Obtener el UID de un usuario por su nombre
async function obtenerUidUsuario(sid, nombreUsuario) {
    try {
        let offset = 0;
        const limit = 50;
        let uid = null;

        while (true) {
            const response = await instance.post(`${api_url}/show-objects`, {
                type: "user",
                limit: limit,
                offset: offset
            }, {
                headers: {
                    'X-chkp-sid': sid
                }
            });

            const usuarios = response.data.objects;

            for (let usuario of usuarios) {
                if (usuario.name === nombreUsuario) {
                    uid = usuario.uid;
                    break;
                }
            }

            if (uid || response.data.to >= response.data.total) {
                break;
            }

            offset += limit;
        }

        if (!uid) {
            console.log(`Usuario ${nombreUsuario} no encontrado.`);
            return null;
        }

        return uid;

    } catch (error) {
        console.error('Error al obtener el UID del usuario:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Renovar la fecha de expiración del usuario
async function renovarUsuario(sid, uid, nuevaFechaExpiracion) {
    try {
        const response = await instance.post(`${api_url}/set-user`, {
            uid: uid,
            "expiration-date": nuevaFechaExpiracion
        }, {
            headers: {
                'X-chkp-sid': sid
            }
        });
        console.log(`Usuario renovado con éxito. Nueva fecha de expiración: ${nuevaFechaExpiracion}`);

    } catch (error) {
        console.error('Error al renovar el usuario:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Crear un nuevo usuario en la API
async function crearUsuario(sid, nombreUsuario, contrasena, fechaExpiracion) {
    try {
        const response = await instance.post(`${api_url}/add-user`, {
            name: nombreUsuario,
            password: contrasena,
            "expiration-date": fechaExpiracion,
            "authentication-method": "INTERNAL_PASSWORD",
            "groups": ["Funcionario"] 
        }, {
            headers: {
                'X-chkp-sid': sid
            }
        });

        console.log(`Usuario ${nombreUsuario} creado exitosamente y asignado al grupo Funcionario.`);
        return response.data.uid;

        // Generar certificado .P12 para el usuario
        //await generarCertificado(sid, uid, p12Password);

    } catch (error) {
        console.error('Error al crear el usuario:', error.response ? error.response.data : error.message);
        throw error;
    }
}
/*
// Generar certificado .P12 para el usuario ANTIGUA
async function generarCertificado(sid, uid) {
    try {
        // Asumimos que existe un comando API para crear certificados, adaptarlo aquí
        const response = await instance.post(`${api_url}/add-server-certificate`, {
            uid: uid,
            "base64-certificate": certificadoBase64,  // Aquí deberías generar y usar el certificado
            "base64-password": passwordBase64
        }, {
            headers: {
                'X-chkp-sid': sid
            }
        });

        console.log(`Certificado .P12 generado para el usuario con UID: ${uid}`);
        return response.data;
    } catch (error) {
        console.error('Error al generar el certificado .P12:', error.response ? error.response.data : error.message);
        throw error;
    }
}*/
/*
// Generar certificado .P12 para el usuario
async function generarCertificado(sid, uid, p12Password) {
    try {
        // Solicitar la creación del certificado
        const response = await instance.post(`${api_url}/generate-internal-ca-certificate`, {
            "uid": uid,
            "certificate-type": "p12",
            "password": p12Password  // Contraseña para proteger el archivo .P12
        }, {
            headers: {
                'X-chkp-sid': sid
            }
        });

        const certificadoData = response.data['p12-file']; // Base64 encoded data of the certificate

        // Escribir el archivo .P12 en el sistema local
        const buffer = Buffer.from(certificadoData, 'base64');
        fs.writeFileSync(`./certificado_${uid}.p12`, buffer);

        console.log(`Certificado generado y guardado como certificado_${uid}.p12`);

    } catch (error) {
        console.error('Error al generar el certificado:', error.response ? error.response.data : error.message);
        throw error;
    }
}
*/

function obtenerFechaExpiracion() {
    const hoy = new Date(); // Obtener la fecha actual
    const unAnioDespues = new Date(hoy.setFullYear(hoy.getFullYear() + 1)); // Añadir un año a la fecha actual

    // Formatear la fecha en "YYYY-MM-DD" para que se ajuste al formato que espera la API
    const year = unAnioDespues.getFullYear();
    const month = String(unAnioDespues.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript son de 0-11
    const day = String(unAnioDespues.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`; // Devolver la fecha en formato "YYYY-MM-DD"
}
 
async function publish(sid) {
    try {
        const response = await instance.post(`${api_url}/publish`, {}, {
            headers: {
                'X-chkp-sid': sid
            }
        });
        console.log('Publish ejecutado con éxito');

        // Esperar un momento para asegurar que la publicación sea procesada
        await new Promise(resolve => setTimeout(resolve, 5000));

        return response.data;
    } catch (error) {
        console.error('Error al publicar los cambios:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Cerrar sesión en la API con reintento
async function logout(sid) {
    try {
        await instance.post(`${api_url}/logout`, {}, {
            headers: {
                'X-chkp-sid': sid
            }
        });
        console.log('Logout exitoso:', sid);
    } catch (error) {
        console.error('Error al cerrar sesión:', error.message);
    }
}

// Ejecutar el proceso de crear usuario y generar certificado
withSession(async (sid) => {
    const uid = await crearUsuario(sid, "F_XavierAlvarado2", "123abc", obtenerFechaExpiracion());
    //await generarCertificado(sid, uid, p12Password);
});




// // Ejecución del script
// (async () => {
//     let sid;
//     try {
//         sid = await login();
//         console.log('Autenticación exitosa. SID:', sid);

//         // PROCESO RENOVAR VPN EXISTENTE
//         // Obtener el UID del usuario "VPN_XavierAlvarado"
//         // const uid = await obtenerUidUsuario(sid, "Funcionario_XavierAlvarado");

//         // if (uid) {
//         //     // Renovar el usuario con la nueva fecha de expiración
//         //     await renovarUsuario(sid, uid, "2025-02-22");
//         //}

//         //PROCESO GENERAR VPN DESDE 0 
//         // Crear un nuevo usuario
//         const uid = await crearUsuario(sid, "F_XavierAlvarado0", "123abc", obtenerFechaExpiracion());

//         // Publicar cambios
//         await publish(sid);

//         // Generar certificado .P12 para el usuario
//         //await generarCertificado(sid, uid, p12Password);  // <--- Aquí agregas esta línea

//         // Obtener la versión de la API
//         // await obtenerVersionAPI(sid);



//     } catch (error) {
//         console.error('Error en la ejecución del script:', error.message);
//     } finally {
//         if (sid) {
//             try {
//                 await publish(sid);
//             } catch (publishError) {
//                 console.error('Error en la publicación antes de cerrar sesión:', publishError.message);
//             } finally {
//                 try {
//                     await logout(sid);
//                 } catch (logoutError) {
//                     console.error('Error al cerrar sesión:', logoutError.response ? logoutError.response.data : logoutError.message);
//                 }
//             }
//         }
//     }
// })();