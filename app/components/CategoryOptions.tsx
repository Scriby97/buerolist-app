import type { FC } from 'react';
import type { Category } from '@/lib/api/categories';
import { formatCategoryNumber, groupCategories } from '@/lib/categories';

/**
 * <option>s fuer eine Kategorien-Auswahl, gegliedert nach Hauptkategorie
 * (<optgroup>) und mit Nummer ("1.03 Streichen"). In ein <select> einsetzen.
 */
export const CategoryOptions: FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    {groupCategories(categories).map(({ group, categories: groupCategoriesList }) => {
      const options = groupCategoriesList.map((category) => {
        const number = formatCategoryNumber(group?.number, category.number);
        return (
          <option key={category.id} value={category.id}>
            {number ? `${number} ${category.name}` : category.name}
          </option>
        );
      });
      return group ? (
        <optgroup key={group.id} label={`${group.number} ${group.name}`}>
          {options}
        </optgroup>
      ) : (
        options
      );
    })}
  </>
);
