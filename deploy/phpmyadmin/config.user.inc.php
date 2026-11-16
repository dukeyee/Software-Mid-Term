<?php
// Use the official image's generated cookie secret and private MySQL host
$cfg['Servers'][1]['auth_type'] = 'cookie';
$cfg['Servers'][1]['AllowNoPassword'] = false;
$cfg['Servers'][1]['AllowRoot'] = false;
$cfg['Servers'][1]['only_db'] = ['software_mid_term'];
$cfg['LoginCookieValidity'] = 1800;
