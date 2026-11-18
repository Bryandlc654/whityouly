# Autenticación de correo (SPF, DKIM y DMARC)

Estado comprobado el 18/11/2026:

| Registro | Estado |
|---|---|
| SPF | Presente: `v=spf1 include:_spf.mail.hostinger.com ~all` |
| DKIM | **Sin publicar** en los selectores habituales |
| DMARC | Presente pero en modo observación: `v=DMARC1; p=none` |

El envío sale por Hostinger SMTP (`smtp.hostinger.com`). Sin DKIM y con
`p=none`, cualquiera puede falsificar el remitente `@withyouly.com` y los
proveedores no rechazan esos correos.

## Cambios necesarios en el panel DNS de Hostinger

1. **Activar DKIM** para el dominio `withyouly.com` en el panel de correo de
   Hostinger. Hostinger publica el selector y la clave pública; no hay que
   generarlos a mano.
2. Publicar DMARC en modo cuarentena (tras unos días de monitorización, pasar a
   `reject`):

```text
Nombre: _dmarc.withyouly.com
Tipo:   TXT
Valor:  v=DMARC1; p=quarantine; sp=quarantine; adkim=s; aspf=s; pct=100; fo=1; rua=mailto:dmarc@withyouly.com
```

3. Endurecer SPF cuando esté confirmado que todo el correo legítimo sale por
   Hostinger:

```text
v=spf1 include:_spf.mail.hostinger.com -all
```

## Verificación

```bash
# DMARC
nslookup -type=TXT _dmarc.withyouly.com 1.1.1.1

# DKIM (sustituir <selector> por el que muestre Hostinger)
nslookup -type=TXT <selector>._domainkey.withyouly.com 1.1.1.1

# SPF
nslookup -type=TXT withyouly.com 1.1.1.1
```

Mientras no se pueda acceder al panel DNS, el código de la aplicación ya evita
otros vectores: los enlaces de recuperación caducan en 15 minutos y los de
verificación en 24 horas, y las sesiones se revocan al cambiar contraseña o
correo.
