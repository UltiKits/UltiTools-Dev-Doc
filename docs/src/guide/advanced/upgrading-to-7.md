# Upgrading from 6.x to 7.0

7.0.0 has not been released. The full upgrade guide will be added in later documentation updates.

This is the starting point for UltiTools module authors and developers of [external plugins that use the framework](/guide/advanced/external-plugin-api). The checklist links to the migration guidance available now. The module JAR admission and `/upm` steps apply to UltiTools modules, not standalone Paper plugins.

## Upgrade Checklist

1. Check the new build target and [requirements for 6.x modules moving to 7.0](./module-versioning#modules-6x-to-7).
2. Review the [removed APIs](./module-versioning#removed-api) and replace old calls before rebuilding.
3. Migrate [text and language files](./module-versioning#text-and-languages-in-7-0) to the 7.0 message system.
4. Check [item construction and storage](./module-versioning#item-construction-7) and [legacy chest pages and confirmation widgets](./module-versioning#legacy-chest-removal).
5. Rebuild and [check the resulting module JAR](./module-versioning#checking-an-artifact).
6. Review [applying module changes and recovery at start-up](./module-versioning#application-and-recovery-at-start-up) before testing the upgrade on a restarted server.
