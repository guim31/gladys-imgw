# IMGW-PIB

Lleva a Gladys los **niveles de los ríos y lagos de Polonia** (Wisła, Odra, Warta, Bug, los
lagos de Masuria y Pomerania, la costa: unas 900 estaciones), con sus **niveles de aviso y de
alarma**, a partir de los datos públicos del **IMGW-PIB**, el instituto polaco de meteorología
y gestión del agua. Sin cuenta, sin clave.

> **Valores brutos: no es un servicio de alerta de crecidas.** Los datos pueden llegar con
> retraso, faltar o ser erróneos, y la integración depende de su Gladys, de su acceso a
> Internet y de un servicio público. En caso de crecida, siga los avisos oficiales (IMGW-PIB,
> su municipio, el 112). Esta integración no está afiliada al IMGW-PIB.

## Lo que obtiene

- **Un dispositivo por estación** seguida: el **nivel del agua** (en cm, como en el mapa del
  IMGW-PIB), el **caudal** en m³/s y la **temperatura del agua** cuando la estación los
  proporciona, el **nivel de alerta** (0 normal, 1 nivel de aviso alcanzado, 2 nivel de alarma
  alcanzado) cuando el IMGW-PIB da sus umbrales, y la fecha de la última medición.
- Una estación que deja de enviar se indica como tal («Sin nueva medición desde…»): un valor
  antiguo nunca se vuelve a enviar como si fuera reciente.
- Tres **disparadores de escena**: se alcanza o se abandona el nivel de aviso o de alarma, una
  estación deja de enviar mediciones, una estación sin datos vuelve a enviar.
- Un **widget de panel**: sus estaciones, su nivel, su tendencia (sube, estable, baja) y su
  nivel de alerta.
- Un botón **«Buscar estaciones»** que enumera las estaciones alrededor de su casa, por nombre,
  por río, por voivodato o por identificador, con su nivel actual.

## Requisitos

- Gladys Assistant **5.1.0** o posterior.
- Acceso a Internet desde Gladys: la integración lee `danepubliczne.imgw.pl`.
- Para «Alrededor de mi casa»: la ubicación de su casa en Gladys (Ajustes, Casas). La
  integración la solicita en la instalación (permiso «ubicación»). Solo se usa dentro del
  contenedor para encontrar las estaciones más cercanas: nunca se envía al IMGW-PIB (la
  integración descarga la lista completa), nunca se guarda ni se registra.
- Solo Polonia.

## Configuración

### Ajustes

| Ajuste                             | Qué hace                                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estaciones                         | Identificadores o nombres de estación, separados por comas: `152210170, Trestno`. Un nombre que llevan varias estaciones se completa con su río: `Krosno Wisłok`.      |
| Alrededor de mi casa               | Sigue también las 3 estaciones más cercanas que envían mediciones, como máximo a 10, 20 o 50 km de su casa.                                                            |
| Intervalo de actualización         | 20, 30 (por defecto) o 60 minutos. Una sola solicitud cubre todas las estaciones.                                                                                      |
| Idioma de los nombres de funciones | Nombres de las funciones de los nuevos dispositivos (Nivel del agua, Caudal…), e idioma del texto «Última medición» y de las variables de escena. Francés por defecto. |

Guarde, abra la pestaña **Descubrir** de la integración y cree los dispositivos que desee. Una
estación sigue siendo seguida mientras exista su dispositivo, aunque la quite de la
configuración.

### Encontrar sus estaciones

Pulse **«Buscar estaciones»** en la configuración. Deje el campo vacío para enumerar las
estaciones alrededor de su casa (20 km, o la distancia elegida), o escriba:

- un nombre de estación: `Wrocław`, `wroclaw` o `WROCLAW` (se ignoran mayúsculas y letras
  polacas);
- un río o un lago: `Wisła`, `Odra`, `Drużno` (las 10 más cercanas, o las 10 primeras por río);
- ambos: `Odra Słubice`;
- un voivodato: `dolnośląskie`;
- un identificador de estación: `152210170`.

Cada línea indica el identificador, el nombre, el río, la distancia a su casa y el nivel actual
(con el nivel de alerta si se alcanza), o «sin medición reciente». Copie los identificadores en
«Estaciones» y guarde.

## Dispositivos

| Función                 | Tipo en Gladys               | Valor                                                                                                                       |
| ----------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Nivel del agua          | Profundidad del líquido (cm) | Nivel sobre el cero de la escala, en cm (stan wody).                                                                        |
| Caudal (m³/s)           | Caudal de agua               | En m³/s (Gladys no tiene unidad m³/s: el nombre lo indica). Calculado por el IMGW-PIB, en algunas estaciones horas después. |
| Temperatura del agua    | Temperatura (°C)             | Un centenar de estaciones, medida una vez al día (06:00 UTC).                                                               |
| Nivel de alerta (0 a 2) | Nivel de riesgo              | 0 bajo el nivel de aviso (stan ostrzegawczy), 1 a partir de él, 2 a partir del nivel de alarma (stan alarmowy).             |
| Última medición         | Texto                        | Fecha del último nivel, o «Sin nueva medición desde…».                                                                      |

Una función solo existe si la estación la proporciona: unas 600 estaciones tienen niveles de
aviso y de alarma, las estaciones de lago a menudo ninguno. El **nivel del agua no es una
profundidad**: es la lectura de la escala, sobre su propio cero. Compárelo con los umbrales de
la misma estación (mostrados en el widget), no con otra estación. Los parámetros del
dispositivo contienen el identificador, el nombre, el río y el voivodato de la estación.

El nivel, el caudal y la temperatura son funciones numéricas: las escenas de Gladys ya pueden
compararlos con cualquier valor propio («Nivel del agua por encima de 650 cm»).

## Widget de panel

Añada el widget **IMGW-PIB** a un panel.

- **Sin ajuste**: una línea por estación seguida (10 como máximo) con su nivel y su tendencia,
  coloreada según su nivel de alerta: verde bajo el nivel de aviso, naranja en el nivel de
  aviso, rojo en el nivel de alarma, gris sin umbrales o sin medición reciente. Un título
  enumera las estaciones en su nivel de aviso o por encima.
- **Con una estación elegida**: su nivel, su caudal y su temperatura del agua en directo,
  después su estado, sus niveles de aviso y de alarma, su tendencia y su última medición, y un
  enlace al mapa del IMGW-PIB.

## Disparadores de escena

| Disparador                             | Filtros                                                              | Variables                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Nivel de aviso o de alarma cruzado     | Estación, nivel (aviso, alarma), sentido (alcanzado, vuelve a bajar) | Nombre de la estación, río o lago, nivel del agua (cm), código y nombre del nivel, su valor (cm), sentido |
| La estación dejó de enviar mediciones  | Estación                                                             | Nombre de la estación, río o lago, fecha de la última medición                                            |
| La estación vuelve a enviar mediciones | Estación                                                             | Nombre de la estación, río o lago, fecha de la última medición                                            |

Los niveles son los que el IMGW-PIB publica para cada estación. Un nivel cuenta como alcanzado
en cuanto el nivel del agua lo iguala; la bajada cuenta cuando el nivel está 2 cm por debajo, y
solo entonces puede contar una nueva subida: un nivel que oscila alrededor de un umbral dispara
una sola vez. Una estación queda sin datos tras 6 horas sin un nuevo nivel.

Los disparadores solo se activan para un dispositivo creado, con una medición reciente, y no
después de un reinicio de más de un día. Un umbral modificado por el IMGW-PIB se toma sin
disparar.

## Ejemplos de escenas

- **El Wisła en Varsovia**: «Nivel de aviso o de alarma cruzado», estación Warszawa-Bulwary,
  nivel «Nivel de aviso», alcanzado → enviar un mensaje: «{{station_name}}: {{height}} cm,
  nivel de aviso ({{threshold_value}} cm) alcanzado».
- **Vigilancia del sótano**: «Nivel de aviso o de alarma cruzado», su estación, nivel «Nivel de
  alarma», alcanzado → encender el enchufe de la bomba y avisar a la familia; el mismo
  disparador con «vuelve a bajar» → «{{station_name}}: de nuevo bajo el nivel de alarma».
- **Vigilancia de la estación**: «La estación dejó de enviar mediciones» → un recordatorio para
  consultar el mapa del IMGW-PIB («{{station_name}} sin datos desde el {{last_reading}}»).

## Fuentes, licencia y cuotas

- «Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy
  Instytut Badawczy» (la fuente de los datos es el IMGW-PIB). «Dane Instytutu Meteorologii i
  Gospodarki Wodnej – Państwowego Instytutu Badawczego zostały przetworzone»: la integración
  calcula a partir de ellos el nivel de alerta y la tendencia. Condiciones de uso:
  [regulamin](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf),
  gratuitas para uso privado.
- Los valores son **datos operativos**, no verificados por el IMGW-PIB: pueden corregirse más
  tarde.
- Sin cuenta, sin clave, sin cuota documentada. La integración se mantiene ligera: **una
  solicitud por actualización** (30 minutos por defecto) para todas las estaciones seguidas,
  unos 550 kB. Las estaciones envían un nivel cada 10 a 60 minutos; el IMGW-PIB los publica una
  media hora después.

## Solución de problemas

- **«Estación desconocida»**: compruebe la ortografía o use «Buscar estaciones» y copie el
  identificador.
- **«Varias estaciones se llaman…»**: añada el río (`Krosno Wisłok`) o use el identificador.
- **«IMGW-PIB no responde»**: el servicio o su acceso a Internet no funciona; los valores
  vuelven solos.
- **«Alrededor de mi casa» no añade nada**: indique la ubicación de su casa (Ajustes, Casas), o
  elija una distancia mayor. Una treintena de estaciones no tienen coordenadas en los datos y
  nunca se eligen así: añádalas por identificador.
- **Sin nivel de alerta**: el IMGW-PIB no da niveles de aviso y de alarma para esta estación
  (muchos lagos y embalses).
- **Sin temperatura del agua**: solo un centenar de estaciones la miden, una vez al día.
- **«Sin nueva medición desde…»**: la estación envía con retraso o ya no envía (avería,
  mantenimiento, hielo).
- Registros: en Gladys, los registros de la integración; `LOG_LEVEL=debug` muestra cada ciclo.

## Límites

- No se necesita hardware; probada contra el servicio real y respuestas grabadas, pero aún no
  en una instalación real de Gladys: sus comentarios son bienvenidos.
- Sin avisos hidrológicos del IMGW-PIB (se dan por cuenca, no por estación), sin previsiones,
  sin fenómenos de hielo: solo mediciones y umbrales.
- 20 estaciones como máximo desde la configuración (más aquellas cuyo dispositivo haya creado).
- Los nombres de las funciones se fijan al crear el dispositivo: cambiar el idioma después solo
  cambia los textos enviados a continuación.
