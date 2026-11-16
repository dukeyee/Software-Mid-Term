FROM phpmyadmin:5.2.3-apache

# Keep one Apache process module, and validate the configuration at build time
RUN a2dismod -f mpm_event mpm_worker \
    && a2enmod mpm_prefork \
    && apache2ctl configtest

COPY deploy/phpmyadmin/config.user.inc.php /etc/phpmyadmin/config.user.inc.php
COPY deploy/phpmyadmin/httpd-shared.conf /etc/phpmyadmin/httpd-shared.conf
COPY deploy/phpmyadmin/start-shared-admin /usr/local/bin/start-shared-admin
RUN sed -i 's/\r$//' /usr/local/bin/start-shared-admin \
    && chmod 755 /usr/local/bin/start-shared-admin \
    && apache2 -f /etc/phpmyadmin/httpd-shared.conf -t
CMD ["/usr/local/bin/start-shared-admin"]
