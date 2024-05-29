/*
 * Copyright (c) 2024 Lars Knudsen <larsgk@gmail.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef BAU_SOURCE_GUI_H
#define BAU_SOURCE_GUI_H

int gui_init(void);
void gui_update_qr_code(const bt_addr_t *addr, uint32_t broadcast_id, uint8_t *name);

#endif /* BAU_SOURCE_GUI_H */
