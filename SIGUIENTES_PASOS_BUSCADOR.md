# Siguientes pasos — Buscador (después de 15 días de medición)

> Este archivo es la guía para **después** de correr la migración
> `supabase/fase-16-search-tracking.sql` y dejarla juntando datos 15 días.
> Objetivo: usar las búsquedas reales de la gente para decidir qué
> sinónimos cargar (Fase B). Pensado para el dueño del proyecto, sin
> tecnicismos.

---

## Recordatorio: qué se está midiendo

Desde que corriste la migración, cada búsqueda de texto en el sitio queda
registrada en la tabla `search_queries` con:

- **el término** que escribió la persona,
- **cuántos resultados** obtuvo (0 = no encontró nada = "miss").

Nada de esto se ve en el sitio. Corre en segundo plano.

---

## Paso 1 — Sacar la foto de los 15 días

Entrá a **Supabase → SQL Editor → New query**, pegá esto y dale **Run**.

### 1.a) ¿Hay datos suficientes?

```sql
select
  count(*)                                  as busquedas_totales,
  count(distinct term_norm)                 as terminos_distintos,
  count(*) filter (where results_count = 0) as sin_resultado,
  count(distinct visitor_id)                as visitantes
from search_queries
where created_at > now() - interval '15 days';
```

**Regla simple:** si `busquedas_totales` es **menos de ~50**, todavía hay
poca data. Esperá otra semana y volvé al Paso 1. Con poca gente usando el
buscador, cualquier conclusión sería apresurada.

### 1.b) Las búsquedas SIN resultado (la lista de trabajo)

```sql
select term_norm as termo, count(*) as buscas, max(created_at) as ultima
from search_queries
where results_count = 0
  and created_at > now() - interval '15 days'
group by term_norm
order by buscas desc
limit 50;
```

Esta es **la lista más importante**. Son las palabras que la gente busca y
el sitio no le muestra nada.

### 1.c) Las búsquedas más frecuentes (contexto)

```sql
select term_norm as termo,
       count(*) as buscas,
       round(avg(results_count),1) as promedio_resultados,
       round(100.0*count(*) filter (where results_count=0)/count(*),0) as pct_sin_resultado
from search_queries
where created_at > now() - interval '15 days'
group by term_norm
order by buscas desc
limit 50;
```

Sirve para ver qué le interesa a la gente y qué búsquedas populares están
fallando (columna `pct_sin_resultado` alta = problema).

---

## Paso 2 — Clasificar cada término sin resultado

Tomá la lista del Paso 1.b y separá cada término en uno de estos 3 grupos:

| Grupo | Qué es | Ejemplo | Qué hacer |
|-------|--------|---------|-----------|
| **A. Sinónimo** | Existe el producto/servicio, pero la gente lo llama distinto (otro idioma, jerga) | Busca `heladera`, el anuncio dice "geladeira" | → Fase B: cargar sinónimo → *Eletrodomésticos* |
| **B. Falta oferta** | Nadie publicó eso todavía | Busca `guincho` y no hay ningún remolque | → No es del buscador. Anotarlo como categoría/oferta a conseguir |
| **C. Ruido** | Errores de tipeo únicos, letras sueltas, cosas sin sentido | `asdf`, `aa`, `.` | → Ignorar |

> **Consejo:** enfocate en los términos que aparecen **2 o más veces**
> (columna `buscas`). Un miss que pasó una sola vez casi nunca vale la pena.

---

## Paso 3 — Armar la lista de sinónimos (para Fase B)

Con los términos del **Grupo A**, armá una tabla simple así (podés hacerlo
en una planilla o anotarlo en un mensaje):

| Lo que busca la gente | A qué categoría / subcategoría debería llevar |
|-----------------------|-----------------------------------------------|
| heladera              | Eletrodomésticos                              |
| alquiler              | Aluguéis                                       |
| flete                 | Translados                                     |
| celular               | Celulares                                      |
| ...                   | ...                                            |

Esa lista es **todo lo que se necesita** para arrancar la Fase B.

---

## Paso 4 — Avisar para implementar la Fase B

Cuando tengas la lista del Paso 3, avisá para hacer la **Fase B**:

1. Se crea la tabla `category_synonyms` (término → categoría/subcategoría).
2. Se conecta al buscador: cuando alguien escriba un sinónimo, el
   desplegable le sugiere la categoría relacionada (aunque el texto no
   coincida con ningún anuncio).
3. La carga y edición de sinónimos queda en el **panel admin**, para que
   puedas sumar nuevos sin depender de nadie.
4. Se precarga la lista inicial que armaste en el Paso 3.

A partir de ahí, cada tanto (una vez por mes, por ejemplo) repetís el
Paso 1.b para ver si aparecieron sinónimos nuevos y los cargás desde el
admin.

---

## Opcional — Ver esto sin entrar al SQL Editor

Ya quedaron listas dos funciones (`get_search_misses` y `get_top_searches`)
para poder mostrar estos datos dentro del **panel admin** con una pantalla
propia, y no tener que pegar consultas SQL. Si preferís esa comodidad,
pedila y se arma la pantalla.

---

## Resumen en una línea

**Correr el Paso 1.b → clasificar (Paso 2) → armar lista de sinónimos
(Paso 3) → pedir la Fase B (Paso 4).**
