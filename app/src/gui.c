/*
 * Copyright (c) 2024 Lars Knudsen <larsgk@gmail.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/device.h>
#include <zephyr/devicetree.h>
#include <zephyr/drivers/display.h>
#include <lvgl.h>
#include <stdio.h>
#include <string.h>
#include <zephyr/kernel.h>
#include <lvgl_input_device.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/sys/base64.h>

lv_obj_t * qr_code;
char qr_data[1024];  // TBD MAX

void gui_update_qr_code(const bt_addr_t *addr, uint32_t broadcast_id, uint8_t *name)
{
	uint8_t addr_str[13];
	uint8_t name_base64[128];
	size_t name_base64_len;

	/* Address */
	snprintk(addr_str, sizeof(addr_str), "%02X%02X%02X%02X%02X%02X",
			addr->val[5], addr->val[4], addr->val[3],
			addr->val[2], addr->val[1], addr->val[0]);

	/* Name */
	base64_encode(name_base64, sizeof(name_base64), &name_base64_len, name, strlen(name));
	name_base64[name_base64_len + 1] = 0;

	/* Most fields hard coded for this demo */
	snprintk(qr_data, sizeof(qr_data),
		 "BLUETOOTH:UUID:184F;BN:%s;SQ:1;AT:1;AD:%s;AS:0;BI:%06X;PI:FFFF;NS:1;BS:1;;",
		 name_base64, addr_str, broadcast_id);

	lv_qrcode_update(qr_code, qr_data, strlen(qr_data));
	lv_task_handler();
}

int gui_init(void)
{
	const struct device *display_dev;

	display_dev = DEVICE_DT_GET(DT_CHOSEN(zephyr_display));
	if (!device_is_ready(display_dev)) {
		printk("Device not ready\n");
		return 0;
	}

	lv_color_t dark_color = lv_color_hex(0x000000);
	lv_color_t light_color = lv_color_hex(0xFFFFFF);

	qr_code = lv_qrcode_create(lv_scr_act(), 180, dark_color, light_color);

	const char * data = "NOTHONG YET;";
	lv_qrcode_update(qr_code, data, strlen(data));
	lv_obj_center(qr_code);

	lv_task_handler();
	display_blanking_off(display_dev);

	return 0;
}
