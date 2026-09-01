# Deprecations

<script setup>
import { data } from '../../deprecations.data.mts'
</script>

This page lists every member UltiTools-API has deprecated, generated from the
framework's own deprecation registry. Each row names the version a member was
announced deprecated in, the version it targets for removal, and — once that
removal has shipped — the version it actually left the API in.

::: tip Slower-updating page
This table reflects the registry snapshot vendored at the time this page was
last synced. For the authoritative, always-current state, consult the
[Javadoc](https://doc.dev.ultikits.com/javadoc).
:::

<table>
  <thead>
    <tr>
      <th>Symbol</th>
      <th>Status</th>
      <th>Since</th>
      <th>Target removal</th>
      <th>Removed in</th>
      <th>Replacement</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="entry in data" :key="entry.key">
      <td><code>{{ entry.className }}{{ entry.memberName ? '#' + entry.memberName + '(...)' : '' }}</code></td>
      <td>{{ entry.status }}</td>
      <td>{{ entry.since }}</td>
      <td>{{ entry.removeIn || '—' }}</td>
      <td>{{ entry.removedIn || '—' }}</td>
      <td>{{ entry.replacement }}</td>
    </tr>
  </tbody>
</table>

## Reading the table

`Status` is one of three values. `DEPRECATED` means the member carries
`@Deprecated` but is not scheduled for removal — its signature stays for
compatibility, and the replacement note explains why. `ANNOUNCED` means the
member carries `@Deprecated(forRemoval = true)` and is still present; the
`Target removal` column names the version it will disappear in. `REMOVED`
means the member is gone from the current API; the `Removed in` column names
the version that happened in, and the type or method itself no longer exists
past that point.

`Target removal` and `Removed in` can differ from `Since` by more than one
release — a member can be deprecated in one version and still be present
several releases later, up until its target version actually ships the
removal.
