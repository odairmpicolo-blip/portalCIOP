export const usuarios = {

 "admin@ciop.com.br":"Administrador",

 "supervisor@ciop.com.br":"Supervisor",

 "analista@ciop.com.br":"Analista"

};
<div id="perfilUsuario"></div>
import { usuarios } from "./usuarios.js";

const perfil =
usuarios[user.email] || "Usuário";

document.getElementById("perfilUsuario")
.innerHTML = perfil;
