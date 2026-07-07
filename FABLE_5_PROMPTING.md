# FABLE_5_PROMPTING.md — Cómo prompear a Fable 5

Síntesis de las ideas clave para trabajar con el modelo **Claude Fable 5**.
Fuente: `tododeia.com/community/fable-5-prompting`. Redactada para uso en Mercado Ilha.

---

## Los 4 principios fundamentales

1. **Prompts cortos y precisos.** "Un párrafo claro le gana a tres páginas." Fable 5
   no necesita instrucciones exhaustivas; cada línea extra es una orden que obedecerá
   **literalmente**, aunque sea contraproducente. Regla práctica: **150–200 palabras**
   para la mayoría de las tareas.

2. **Objetivo + Razón, no pasos.** Comunicá la *intención final* y *para quién* es el
   resultado. El modelo deduce solo los pasos cuando entiende el "para qué". Dictar el
   paso a paso limita su inteligencia a *tus* puntos ciegos.

3. **Límites explícitos.** Definí qué **NO** debe tocarse y **cuándo pedir confirmación**.
   Sin fronteras, Fable 5 expande el alcance, reformatea todo o agrega features no pedidas
   bajo el pretexto de "mejorar". Preferí **un único límite duro** claro antes que una
   lista larga de restricciones (las listas largas compiten entre sí y degradan el
   resultado).

4. **Pedir evidencia, no promesas.** "Ya está hecho" no es prueba. Cada afirmación debe
   poder señalar la acción concreta que la respalda. Pedí que **separe lo comprobado de
   lo pendiente** en el informe final.

---

## Plantilla maestra de prompt

```
Contexto:      Estoy trabajando en [OBJETIVO] para [DESTINATARIO].
Necesidad:     Necesitan [QUÉ PERMITE EL RESULTADO].
Petición:      Lo que te pido: [DESCRIPCIÓN EN 1–3 ORACIONES].
Límites:       No toques [ELEMENTOS PROTEGIDOS]. Si necesitás [DECISIÓN CLAVE], preguntá primero.
Verificación:  Reportá solo lo que puedas comprobar; marcá lo pendiente explícitamente.
```

Componentes esenciales: **brevedad**, **destinatario claro** (quién usa el resultado y
cómo), **un solo límite duro**, y **contexto temporal/plazo** cuando aplique.

---

## Niveles de esfuerzo (`/effort`)

| Nivel | Cuándo usarlo |
|---|---|
| **Low** | Tareas rutinarias, alto volumen. |
| **Medium** | Preguntas directas, ediciones simples. |
| **High** | **Default recomendado.** |
| **Xhigh** | Trabajo crítico, decisiones caras de revertir. |

---

## Buenas prácticas avanzadas

- **Operación autónoma:** si no vas a supervisar en vivo, decile explícitamente que
  **puede proceder sin validación en acciones reversibles**, pero que debe **completar el
  trabajo o indicar dónde se bloqueó**.
- **Memoria entre sesiones:** mantené una carpeta con lecciones (un archivo por concepto),
  documentando tanto correcciones como enfoques confirmados. Limpiá notas duplicadas o
  inexactas. *(En este proyecto: `MEMORY.md` + carpeta de memoria.)*
- **Subagentes:** autorizá explícitamente crear subagentes para subtareas paralelas. Para
  control de calidad, **un subagente con contexto fresco revisa mejor** que la autocrítica
  del propio modelo.

---

## Errores críticos a evitar

- **Sobreinstrucción:** páginas de reglas crean conflictos internos y empeoran resultados.
- **Dictar procedimientos:** los pasos debe descubrirlos el modelo, no imponerlos vos.
- **Ausencia de límites:** sin fronteras asume autoridad para ampliar alcance.
- **Aceptar promesas sin verificar.**
- **Pedir el razonamiento interno / monólogo del modelo:** activa clasificadores de
  seguridad que redirigen la sesión a Opus 4.8. Pedí **conclusiones y evidencia**, nunca
  el "pensamiento en voz alta".

---

## Sesiones largas

- **Contra la sobreplaneación:** cuando ya hay info suficiente para actuar, que **actúe**.
  Nada de re-deducir hechos ya establecidos.
- **Manejo de contexto:** si el modelo se preocupa por el espacio disponible,
  tranquilizalo explícitamente para evitar cortes innecesarios.
- **Desbloqueo:** si anuncia una acción pero no la ejecuta, un simple **"continuá"** o
  **"hacelo de principio a fin"** suele resolverlo.

---

## Migrar prompts viejos (de modelos anteriores)

Revisá instrucciones previas y **quitá**: listas de pasos ahora contraproducentes,
recordatorios repetitivos redundantes, reglas que compiten entre sí, y pedidos de
razonamiento que activan clasificadores. **Mantené** los pilares atemporales: contexto
claro, ejemplos sólidos, formato definido. Bajá la verbosidad drásticamente.
