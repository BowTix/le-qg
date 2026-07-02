FROM php:8.2-apache

# 1. Installer les dépendances système et PHP
RUN apt-get update && apt-get install -y unzip git \
    && docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite headers

# 2. Installer Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 3. Copier tout ton code
COPY . /var/www/html/

# 4. Configurer le dossier public comme racine
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# 5. La méthode forte : Forcer Apache à tout envoyer vers index.php (sans avoir besoin de .htaccess)
RUN echo "<Directory /var/www/html/public>" >> /etc/apache2/apache2.conf \
    && echo "    AllowOverride All" >> /etc/apache2/apache2.conf \
    && echo "    FallbackResource /index.php" >> /etc/apache2/apache2.conf \
    && echo "</Directory>" >> /etc/apache2/apache2.conf

# 6. Installer les paquets PHP s'il y a un composer.json
RUN if [ -f "composer.json" ]; then composer install --no-dev --optimize-autoloader; fi