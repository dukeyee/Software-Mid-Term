FROM phpmyadmin:5.2.3-apache

# Keep one Apache process module, and validate the configuration at build time
RUN a2dismod -f mpm_event mpm_worker \
    && a2enmod mpm_prefork \
    && apache2ctl configtest

COPY deploy/phpmyadmin/config.user.inc.php /etc/phpmyadmin/config.user.inc.php
