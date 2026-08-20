<?php
/**
 * Espelho PHP da página do portal.
 * O GitHub Pages não executa PHP — use pontualidade-ajustada.html no site.
 * Se este arquivo rodar num Apache/nginx+PHP, entrega a mesma tela.
 */
header("Content-Type: text/html; charset=utf-8");
readfile(__DIR__ . "/pontualidade-ajustada.html");
