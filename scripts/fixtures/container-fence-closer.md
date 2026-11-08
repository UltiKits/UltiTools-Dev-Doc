# Fixture: a ::: line inside a fenced block

A container whose fenced example holds a bare `:::` line. The fence must not
close the container, so the four sentences after it count and exit 1 is expected.

::: tip Fenced closer
One sentence.

~~~~md
:::
~~~~

Two. Three. Four.
:::
